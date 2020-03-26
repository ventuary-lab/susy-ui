import React, { Component } from 'react';
import './App.css';
import {invokeScript, address, nodeInteraction, broadcast, waitForTx, balance, assetBalance, seedUtils, lease, cancelLease} from "@waves/waves-transactions"

import Web3 from 'web3';

class App extends Component {
  nodeUrl =  "https://nodes.wavesnodes.com"
  wvs = 1000000
  chainId = 'W'
  web3 = null
  contract = null
  ercContract = null
  ethContractAddress = "0x6D8dE1a5384CA68eb525707D9b5b49e63A3e62Ed"
  constructor(props) {
    super(props)
    this.state = {
      wavesSusyContract: "3PLNtYARHKSspK7q6Ed4KnrMU2x9sD4bzwz",
      wavesSusyContractData: {},
      dataOther: {},
      ethEventsNewRq: []
    }
    this.updateData()
    setInterval(() => this.updateData(), 600);
    if (window.web3) {
      let jsonContract = require('./Supersymmetry.json');
      this.web3 = new Web3(window.web3.currentProvider);
      this.contract = new this.web3.eth.Contract(jsonContract, this.ethContractAddress)
    }
    else {
      alert('You have to install MetaMask !');
    }
  }

  getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
  }
  convertToMap(array){
    let newMap = {}
    for(var key in array) {
        newMap[key] = array[key].value;
      }
    return newMap;
  }

  async updateData() {
    let result = await nodeInteraction.accountData(this.state.wavesSusyContract, this.nodeUrl)
    this.setState({ wavesSusyContractData: this.convertToMap(result) });
    
    if (this.state.dataOther.address == undefined) {
      await window.WavesKeeper.initialPromise
      let wavesState = await window.WavesKeeper.publicState();
      let address = wavesState.account.address
      let other = {
        address : address,
        balance : 0
      }
      this.setState({ dataOther: other });
      return
    }

    let address = this.state.dataOther.address
    
    let ethAccount = (await this.web3.eth.getAccounts())[0]
    if (this.ercContract == null) {
      let tokenJsonContract = require('./Token.json');
      let ercToken = await this.contract.methods.tokenAddress().call()
      let ercContract = new this.web3.eth.Contract(tokenJsonContract, ercToken)
      this.ercContract = ercContract
    }
    let other = {
      address : address,
      ethAccount: ethAccount,
      balance : await nodeInteraction.assetBalance(this.state.wavesSusyContractData.asset_id, address, this.nodeUrl),
      ethBalance: (await this.ercContract.methods.balanceOf(ethAccount).call())/1000000000000
    }
    this.setState({ dataOther: other });
    let events = await this.contract.getPastEvents('NewRequest', {
      fromBlock: 0,
      toBlock: 'latest'
    })
    let ethRq = []
    for(let index in events) {
      let event = events[index]
      let rq = await this.contract.methods.requests(event.returnValues.requestHash).call()
      rq.id = event.returnValues.requestHash
      ethRq.push(rq);
    }

    this.setState({ ethRq: ethRq });
  }
  
  getRequests(statusRq) {
    let keys = Object.keys(this.state.wavesSusyContractData)
    let requests = []
    requests.push(
      <div id="solid">
        Hash | {" "}
        Status | {" "}
        Type | { " " }
        Target | { " " }
        Amount | 
      </div>
    )

    keys.forEach(key => {
      if (key.startsWith("owner_") && this.state.wavesSusyContractData[key] == this.state.dataOther.address) {
        let hash = key.replace("owner_","")
        let status = ""
        let owner = this.state.wavesSusyContractData["owner_" + hash]
        let target = this.state.wavesSusyContractData["target_" + hash]
        let amount = this.state.wavesSusyContractData["amount_" + hash]/this.wvs
        let type = ""
        switch (this.state.wavesSusyContractData["status_" + hash]) {
          case 1:
            status = "NEW"
            break;
          case 2:
            status = "REJECTED"
            break;
          case 3:
            status = "SUCCESS"
            break;
        }
        switch (this.state.wavesSusyContractData["type_" + hash]) {
          case 0:
            type = "LOCK"
            break;
          case 1:
            type = "UNLOCK"
            break;
        }
        if (status == statusRq) {
          requests.push(
            <div id="solid">
              {hash} | {" "}
              {status} | {" "}
              {type} | { " " }
              {this.state.wavesSusyContractData["target_" + hash]} | { " " }
              {amount} | {status == "SUCCESS" && type == "LOCK" ? 
                <button type="submit" onClick={() => this.mint(owner, amount)}>Create eth request</button> : ""}
            </div>
          )
        }
      }
    });
    return requests;
  }

  getEthRequests(statusRq) {
    let requests = []
    requests.push(
      <div id="solid">
        Hash | {" "}
        Status | {" "}
        Type | { " " }
        Target | { " " }
        Amount | 
      </div>
    )
    for(let index in this.state.ethRq) {
      let event = this.state.ethRq[index]
      let status = ""
      let type = ""
      switch (Number(event.status)) {
        case 1:
          status = "NEW"
          break;
        case 2:
          status = "REJECTED"
          break;
        case 3:
          status = "SUCCESS"
          break;
      }
      switch (Number(event.rType)) {
        case 0:
          type = "BURN"
          break;
        case 1:
          type = "MINT"
          break;
      }


      if (status == statusRq) {
        let amount = this.web3.utils.fromWei(event.tokenAmount)
        requests.push(
          <div id="solid">
            {event.id} | {" "}
            {status} | {" "}
            {type} | { " " }
            {event.target} | { " " }
            {amount} | 
            {status == "SUCCESS" && type == "BURN" ? 
                <button type="submit" onClick={() => this.unlock(event.owner, amount)}>Create waves request</button> : ""}
          </div>
        )
      }

     
    }
    return requests;
  }

  testFaucet = async () => {
      await window.WavesKeeper.signAndPublishTransaction({
        type: 16,
        data: {
             fee: {
                 tokens: 0.05,
                 assetId: "WAVES"
             },
             dApp: this.state.wavesSusyContract,
             call: {
             		function: 'testFaucet',
             		args: []
             	}, payment: []
        }
      }).then((tx) => {
        console.log(tx);
        this.setState({lastTxHash: JSON.parse(tx).id })
      }).catch((error) => {
        alert("Что-то пошло не так", error);
      });
  }
  
  changeStatusTest = async () => {
    await window.WavesKeeper.signAndPublishTransaction({
      type: 16,
      data: {
           fee: {
               tokens: 0.05,
               assetId: "WAVES"
           },
           dApp: this.state.wavesSusyContract,
           call: {
               function: 'changeStatusTest',
               args: [
                {
                  type: "string",
                  value: this.state.wavesRequestId
                },
                {
                  type: "integer",
                  value: this.state.wavesRequestStatus
                }
              ]
             }, payment: []
      }
    }).then((tx) => {
      console.log(tx);
      this.setState({lastTxHash: JSON.parse(tx).id })
    }).catch((error) => {
      alert("Что-то пошло не так", error);
    });
  }

  changeEthStatusTest = async () => {
    let accounts = await this.web3.eth.getAccounts()
    await this.contract.methods.changeStatusTest(this.state.ethRequestId, this.state.ethRequestStatus).send({from: accounts[0]})
  }
  
  lock = async () => {
    let tx = await window.WavesKeeper.signAndPublishTransaction({
      type: 16,
      data: {
           fee: {
               tokens: 0.05,
               assetId: "WAVES"
           },
           dApp: this.state.wavesSusyContract,
           call: {
               function: 'createLockRequest',
               args: [
                {
                  type: "string",
                  value: this.state.ethRecipient
                }
              ]
             }, payment: [{assetId: this.state.wavesSusyContractData.asset_id, tokens: this.state.lockAmount }]
      }
    })
    console.log(tx);
    let jsonTx = JSON.parse(tx)
    this.setState({lastTxHash: jsonTx.id })
    console.log(jsonTx.sender);
    await this.mint(jsonTx.sender, this.state.lockAmount)
   
  }

  async unlock(owner, amount) {
    console.log(amount * this.wvs)
    await window.WavesKeeper.signAndPublishTransaction({
      type: 16,
      data: {
           fee: {
               tokens: 0.05,
               assetId: "WAVES"
           },
           dApp: this.state.wavesSusyContract,
           call: {
               function: 'createUnlockRequest',
               args: [
                {
                  type: "string",
                  value: owner
                },
                {
                  type: "integer",
                  value: amount * this.wvs
                }
              ]
             }, payment: []
      }
    }).then((tx) => {
      console.log(tx);
      this.setState({lastTxHash: JSON.parse(tx).id })
    }).catch((error) => {
      alert("Что-то пошло не так", error);
      console.log(error);
    });
  }

  burn = async() => {
    let amount = this.web3.utils.toWei(String(this.state.burnAmount, 'ether'))
    await this.ercContract.methods.approve(this.ethContractAddress, amount).send({from: this.state.dataOther.ethAccount})
    await this.contract.methods.createBurnRequest(this.state.burnRecipient, amount).send({from: this.state.dataOther.ethAccount})
    await this.unlock(this.state.burnRecipient, this.state.burnAmount)
  }

  async mint(owner, amount) {
    await this.contract.methods.createMintRequest(owner, this.web3.utils.toWei(String(amount), 'ether')).send({from: this.state.dataOther.ethAccount})
  }


  render() {
    return (
      <div className="App">
         LastTxHash: {this.state.lastTxHash} | {' '}
        {this.state.dataOther.balance/this.wvs} USDN | {' '}
        {this.state.dataOther.ethBalance/this.wvs} sUSDN | {' '}
        <div id="grid">
          <div>
            <h3>Contracts</h3>
            <label>
              Amount : <input type="text" value={this.state.lockAmount} onChange={(event) => this.setState({ lockAmount: event.target.value })} />
              Recipient : <input type="text" value={this.state.ethRecipient} onChange={(event) => this.setState({ ethRecipient: event.target.value })} />
            </label>
            <br/><button type="submit" onClick={this.lock}>Lock</button>
            
            <br/><label>
              Amount : <input type="text" value={this.state.burnAmount} onChange={(event) => this.setState({ burnAmount: event.target.value })} />
              Recipient : <input type="text" value={this.state.burnRecipient} onChange={(event) => this.setState({ burnRecipient: event.target.value })} />
            </label>
            <br/><button type="submit" onClick={this.burn}>Burn</button>
          </div>
        </div>
        </div>
    );
  }
}

export default App;
