// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

///@author Aashish Nandkumar

/// @dev Ignore the errors in import
import "@openzeppelin/contracts/access/Ownable.sol";

// creating an interface for FakeNFTMarketplace
interface IFakeNFTMarketPlace {
    function getPrice() external view returns (uint256);

    function available(uint256 _tokenId) external view returns (bool);

    function purchase(uint256 _tokenId) external payable;
}

// create an interface for CryptoDevsNFT
interface ICryptoDevsNFT {
    /// @dev This returns the no of NFTS held by the owner
    function balanceOf(address owner) external view returns (uint256);

    /// @dev This returns a tokenId at given index of the owner
    function tokenOfOwnerByIndex(
        address owner,
        uint256 index
    ) external view returns (uint256);
}

contract CryptoDevsDAO is Ownable {
    struct Proposal {
        // The tokenId of the NFT to be purchased from the marketplace
        uint256 nftTokenId;
        // set a deadline until which the proposal is active
        uint256 deadline;
        // no of yes votes
        uint256 yesVotes;
        // no of no votes
        uint256 noVotes;
        // To check if the proposal is executed
        bool executed;
        // A mapping to define the Crypto NFT has already been used to cast a vote
        mapping(uint256 => bool) voters;
    }

    // To count the no of proposals created
    uint256 public numProposals;
    // A maping of proposal Ids to proposal
    mapping(uint256 => Proposal) public proposals;

    // create variables to store FakeNFTMarketplace and CryptoDevsNFT contract
    IFakeNFTMarketPlace nftMarketplace;
    ICryptoDevsNFT cryptoDevsNFT;

    // A constructor to initialize the above variables
    constructor(address _nftMarketplace, address _cryptoDevsNFT) payable {
        nftMarketplace = IFakeNFTMarketPlace(_nftMarketplace);
        cryptoDevsNFT = ICryptoDevsNFT(_cryptoDevsNFT);
    }

    // We only want the addresses which hold CryptoDevNft to participate, hence create a custom modifier
    modifier nftHolderOnly() {
        require(cryptoDevsNFT.balanceOf(msg.sender) > 0, "NOT A DAO MEMBER");
        _;
    }

    /// @dev Allowing users to create proposal
    function createProposal(
        uint256 _nftTokenId
    ) external nftHolderOnly returns (uint256) {
        require(
            nftMarketplace.available(_nftTokenId),
            "NFT not available for sale"
        );
        Proposal storage proposal = proposals[numProposals];
        // set the proposal's voting deadline
        proposal.deadline = block.timestamp + 5 minutes;

        numProposals++;

        return numProposals - 1;
    }

    // we need to make sure the proposal that is to be voted has not exceeded deadline, so we create another modifer
    modifier activeProposalOnly(uint256 proposalIndex) {
        require(
            proposals[proposalIndex].deadline > block.timestamp,
            "Deadline exceeded"
        );
        _;
    }

    // since the vote can be two options -> yes or no, we can create an ENUM
    enum Vote {
        YES,
        NO
    }

    /// @dev Allowing the CryptoDevNFT holder to cast their vote
    function voteOnProposal(
        uint256 proposalIndex,
        Vote vote
    ) external nftHolderOnly activeProposalOnly(proposalIndex) {
        Proposal storage proposal = proposals[proposalIndex];

        uint256 voterNFTBalance = cryptoDevsNFT.balanceOf(msg.sender);
        uint256 numVotes = 0;

        // calculate the no og nfts the voter has that hasnt been already used for voting in this proposal
        for (uint256 i = 0; i < voterNFTBalance; i++) {
            uint256 tokenId = cryptoDevsNFT.tokenOfOwnerByIndex(msg.sender, i);
            if (proposal.voters[tokenId] == false) {
                numVotes++;
                proposal.voters[tokenId] = true;
            }
        }
        require(numVotes > 0, "Already Voted");
        if (vote == Vote.YES) {
            proposal.yesVotes += 1;
        } else {
            proposal.noVotes += 1;
        }
    }

    // We need to execute our proposals whenver the deadline has exceeded
    modifier inactiveProposalOnly(uint256 proposalIndex) {
        require(
            proposals[proposalIndex].deadline <= block.timestamp,
            "Deadline has not exceeded, proposal is still active!"
        );
        require(
            proposals[proposalIndex].executed == false,
            "Proposal already accepted!"
        );
        _;
    }

    /// @dev We need to execute the proposal if it is voted for only
    function executeProposal(
        uint256 proposalIndex
    ) external nftHolderOnly inactiveProposalOnly(proposalIndex) {
        Proposal storage proposal = proposals[proposalIndex];

        // check if this proposals have a greater no of yes votes
        if (proposal.yesVotes > proposal.noVotes) {
            uint256 nftPrice = nftMarketplace.getPrice();
            require(address(this).balance >= nftPrice, "Not enough funds");
            nftMarketplace.purchase{value: nftPrice}(proposal.nftTokenId);
        }
        proposal.executed = true;
    }

    /// @dev Withdraw ETH from the DAO
    function withdrawEther() external onlyOwner {
        uint256 amount = address(this).balance;
        require(amount > 0, "Nothing to withdraw, contract balance empty");
        (bool sent, ) = payable(owner()).call{value: amount}("");
        require(sent, "Failed to withdraw ether from the conract");
    }

    // Allowing the users to deposit ether to the DAO treasury
    receive() external payable {}

    fallback() external payable {}
}
