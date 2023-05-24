import Head from "next/head";
import styles from "../styles/Home.module.css";
import { Contract, providers } from "ethers";
import { formatEther } from "ethers/lib/utils";
import { useEffect, useState, useRef } from "react";
import Web3Modal from "web3modal";
import {
  CRYPTODEVS_DAO_ABI,
  CRYPTODEVS_DAO_CONTRACT_ADDRESS,
  CRYPTODEVS_NFT_ABI,
  CRYPTODEVS_NFT_CONTRACT_ADDRESS,
} from "../constants";

function Home() {
  // ETH balance of DAO contract
  const [treasuryBalance, setTreasuryBalance] = useState("0");
  // no of proposals created in DAO contract
  const [numProposals, setNumProposals] = useState("0");
  // Array of all proposals created in DAO
  const [proposals, setProposals] = useState([]);
  // user's balance of cryptoDev NFTs
  const [nftBalance, setNftBalance] = useState(0);
  // fakeNFT Token Id
  const [fakeNftTokenId, setFakeNftTokenId] = useState("");
  // u will either choose view or create proposals
  const [selectedTab, setSelectedTab] = useState("");
  // Loading screen
  const [loading, setLoading] = useState(false);
  // Check if the wallet is connected
  const [walletConnected, setWalletConnected] = useState(false);
  // check if the address is an owner
  const [isOwner, setIsOwner] = useState(false);
  // create an empty instance of web3modal
  const web3ModalRef = useRef();

  // A helper function to connect wallet
  async function connectWallet() {
    try {
      await getProviderOrSigner();
      setWalletConnected(true);
    } catch (err) {
      console.error(err);
    }
  }

  // checks if the connected address is the contract owner
  async function getDAOOwner() {
    try {
      const signer = await getProviderOrSigner(true);

      // get an instance of DAO contract
      const contract = getDaoContractInstance(signer);
      // get the contract owner
      const _owner = await contract.owner();
      // get the address associated with the signer
      const address = await signer.getAddress();
      if (address.toLowerCase() === _owner.toLowerCase()) {
        setIsOwner(true);
      }
    } catch (err) {
      console.error(err);
    }
  }

  //  withdraw the ether from the contract
  async function withdrawDAOEther() {
    try {
      const signer = await getProviderOrSigner(true);
      const contract = getDaoContractInstance();

      const tx = await contract.withdrawEther();
      setLoading(true);
      await tx.wait();
      setLoading(false);
      getDAOTreasuryBalance();
    } catch (err) {
      console.error(err);
    }
  }

  // Get the ETH balance of DAO contract
  async function getDAOTreasuryBalance() {
    try {
      const provider = await getProviderOrSigner();
      // * NEW WAY TO GET BALANCE
      const balance = await provider.getBalance(
        CRYPTODEVS_DAO_CONTRACT_ADDRESS
      );
      setTreasuryBalance(balance.toString());
    } catch (err) {
      console.error(err);
    }
  }

  // Read the no of proposals in DAO contract
  async function getNumProposalsInDAO() {
    try {
      const provider = await getProviderOrSigner();
      const contract = getDaoContractInstance(provider);
      const daoNumProposals = await contract.numProposals();
      setNumProposals(daoNumProposals.toString());
    } catch (err) {
      console.error(err);
    }
  }

  // Read the balance of users Crypto-dev NFTs
  async function getUserNFTBalance() {
    try {
      const signer = await getProviderOrSigner(true);
      const nftContract = getCryptodevsNFTContractInstance(signer);
      const balance = await nftContract.balanceOf(signer.getAddress());
      setNftBalance(parseInt(balance.toString()));
    } catch (err) {
      console.error(err);
    }
  }

  // create a proposal
  async function createProposal() {
    try {
      const signer = await getProviderOrSigner(true);
      const daoContract = getDaoContractInstance(signer);
      const tx = await daoContract.createProposal(fakeNftTokenId);
      setLoading(true);
      await tx.wait();
      // now we have to increment the no of proposals created in DAO
      await getNumProposalsInDAO();
      setLoading(false);
    } catch (err) {
      console.error(err);
      window.alert(err.reason);
    }
  }
  // fetch a proposal and parse it into object based on proposal ID
  async function fetchProposalById(id) {
    try {
      const provider = await getProviderOrSigner();
      const daoContract = getDaoContractInstance(provider);
      const proposal = daoContract.proposals(id);
      const parsedProposal = {
        proposalId: id,
        nftTokenId: proposal.nftTokenId.toString(),
        deadline: new Date(parseInt(proposal.deadline.toString()) * 1000),
        yesVotes: proposal.yesVotes.toString(),
        noVotes: proposal.noVotes.toString(),
        executed: proposal.executed,
      };
      return parsedProposal;
    } catch (err) {
      console.error(err);
      window.alert(err.reason);
    }
  }

  // fetch all the proposals in DAO
  async function fetchAllProposals() {
    try {
      // Assign with empty array
      const proposals = [];
      for (let i = 0; i < numProposals; i++) {
        const proposal = await fetchProposalById(i);
        proposals.push(proposal);
      }
      setProposals(proposals);
      return proposals;
    } catch (err) {
      console.error(err);
      window.alert(err.reason);
    }
  }

  // Call the voteOnProposal fxn from contract
  async function voteOnProposal(proposalId, _vote) {
    try {
      const signer = await getProviderOrSigner(true);
      const daoContract = getDaoContractInstance(signer);

      let vote = _vote === "YES" ? 0 : 1;
      const tx = await daoContract.voteOnProposal(proposalId, vote);
      setLoading(true);
      await tx.wait();
      setLoading(false);
      await fetchAllProposals();
    } catch (err) {
      console.error(err);
      window.alert(err.reason);
    }
  }

  // execute the proposal if it is voted for
  async function executeProposal(proposalId) {
    try {
      const signer = await getProviderOrSigner(true);
      const daoContract = getDaoContractInstance(signer);
      const tx = await daoContract.executeProposal(proposalId);
      setLoading(true);
      await tx.wait();
      setLoading(false);
      await fetchAllProposals();
      // !
      getDAOTreasuryBalance();
    } catch (err) {
      console.error(err);
      window.alert(err.reason);
    }
  }

  // Get a provider or signer
  async function getProviderOrSigner(needSigner = false) {
    const provider = await web3ModalRef.current.connect();
    const web3Provider = new providers.Web3Provider(provider);

    const { chainID } = await web3Provider.getNetwork();
    if (chainID != 11155111) {
      window.alert("Please change the network to Sepolia testnet");
      throw new Error("Please switch to Sepolia testnet");
    }

    if (needSigner) {
      const signer = web3Provider.getSigner();
      return signer;
    }
    return web3Provider;
  }

  // Get the DAO contract instance
  function getDaoContractInstance(providerOrSigner) {
    return new Contract(
      CRYPTODEVS_DAO_CONTRACT_ADDRESS,
      CRYPTODEVS_DAO_ABI,
      providerOrSigner
    );
  }

  // get the NFT contract instance
  function getCryptodevsNFTContractInstance(providerOrSigner) {
    return new Contract(
      CRYPTODEVS_NFT_CONTRACT_ADDRESS,
      CRYPTODEVS_NFT_ABI,
      providerOrSigner
    );
  }

  // provide necessary changes if wallet not connected
  useEffect(() => {
    if (!walletConnected) {
      web3ModalRef.current = new Web3Modal({
        network: "sepolia",
        providerOptions: {},
        disableInjectedProvider: false,
      });

      connectWallet().then(() => {
        getDAOTreasuryBalance();
        getUserNFTBalance();
        getNumProposalsInDAO();
        getDAOOwner();
      });
    }
  }, [walletConnected]);

  // do the necessary effects when a certain tab is selected
  useEffect(() => {
    if (selectedTab === "View Proposals") {
      fetchAllProposals();
    }
  }, [selectedTab]);

  // render the contents of appropriate tabs
  function renderTabs() {
    if (selectedTab === "Create Proposal") {
      return renderCreateProposalsTab();
    } else if (selectedTab === "View Proposals") {
      return renderViewProposalsTab();
    }
    return null;
  }
}

export default Home;
