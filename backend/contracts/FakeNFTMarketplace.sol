// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

/// @author Aashish Nandakumar

contract FakeNFTMarketplace {
    /// @dev Mapping of fake tokenId to owner address
    mapping(uint256 => address) public tokens;
    /// @dev Set the price for each Fake NFT
    uint256 nftPrice = 0.0001 ether;

    /// @dev This accepts ETH and marks the owner of the given tokenId
    /// @param _tokenId : The fake tokenId to purchase
    function purchase(uint256 _tokenId) external payable {
        require(msg.value == nftPrice, "This NFT costs 0.0001 ether");
        tokens[_tokenId] = msg.sender;
    }

    /// @dev Returns the price of one Fake NFT
    function getPrice() external view returns (uint256) {
        return nftPrice;
    }

    /// @dev Checks if the provided tokenId has already been sold
    /// @param _tokenId: The tokenId to verify
    function available(uint256 _tokenId) external view returns (bool) {
        // address(0) default value: 0x0000000000000000000000000000000000000000
        if (tokens[_tokenId] == address(0)) {
            return true;
        }
        return false;
    }
}
