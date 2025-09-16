// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

// Minimal HTS interface
interface IHederaTokenService {
    function mintToken(
        address token,
        uint64 amount,
        bytes[] calldata metadata
    )
        external
        returns (
            int64 responseCode,
            int64 newTotalSupply,
            int64[] memory serialNumbers
        );

    function associateToken(address account, address token)
        external
        returns (int64 responseCode);

    function transferToken(
        address token,
        address sender,
        address recipient,
        int64 serial
    ) external returns (int64 responseCode);
}

contract DinoNftMinter {
    // ----- config -----
    address public immutable tokenAddress; // HTS NFT token address
    address public immutable treasury;     // Treasury that initially holds mints
    address public owner;                  // contract owner (can update minter)
    address public minter;                 // address allowed to call mintAndSend

    // Hedera HTS precompile (fixed address on Hedera)
    // IHederaTokenService public constant hts = IHederaTokenService(0x167);
    IHederaTokenService public constant hts = IHederaTokenService(address(0x167));

    // Hedera response codes
    int64 private constant RC_SUCCESS = 22;
    int64 private constant RC_ALREADY_ASSOCIATED = 2041;

    // ----- simple reentrancy guard -----
    bool private _locked;
    modifier nonReentrant() {
        require(!_locked, "REENTRANCY");
        _locked = true;
        _;
        _locked = false;
    }

    // ----- access control -----
    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    modifier onlyMinter() {
        require(msg.sender == minter, "NOT_MINTER");
        _;
    }

    event NftMinted(address indexed to, int64 serial, string metadataURI);
    event MinterUpdated(address indexed newMinter);

    constructor(
        address _tokenAddress,
        address _treasury,
        address _minter
    ) {
        require(_tokenAddress != address(0), "ZERO_TOKEN");
        require(_treasury != address(0), "ZERO_TREASURY");
        tokenAddress = _tokenAddress;
        treasury = _treasury;
        owner = msg.sender;
        minter = _minter;
    }

    function updateMinter(address newMinter) external onlyOwner {
        minter = newMinter;
        emit MinterUpdated(newMinter);
    }

    /**
     * Mints one NFT with `metadataURI` to treasury, ensures `recipient` is associated,
     * then transfers the newly minted serial to `recipient`.
     *
     * NOTE: If association from a contract to a user account is not permitted in your
     * wallet/flow, remove the associate call and have the user associate first.
     */
    function mintAndSend(address recipient, string calldata metadataURI)
        external
        nonReentrant
        onlyMinter
    {
        // 1) build metadata array correctly
        bytes[] memory metadata;
        metadata = new bytes[](1);
        metadata[0] = bytes(metadataURI);


        // 2) mint (amount=0 for NFTs; metadata length defines # of serials)
        (int64 code, , int64[] memory serials) = hts.mintToken(
            tokenAddress,
            0,
            metadata
        );
        require(code == RC_SUCCESS, "MINT_FAIL");

        int64 serial = serials[0];

        // 3) associate recipient (ok if already associated)
        code = hts.associateToken(recipient, tokenAddress);
        require(
            code == RC_SUCCESS || code == RC_ALREADY_ASSOCIATED,
            "ASSOC_FAIL"
        );

        // 4) transfer minted serial from treasury -> recipient
        code = hts.transferToken(tokenAddress, treasury, recipient, serial);
        require(code == RC_SUCCESS, "XFER_FAIL");

        emit NftMinted(recipient, serial, metadataURI);
    }
}
