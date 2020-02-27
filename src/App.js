import React, { Component } from 'react';
import './App.css';
import {invokeScript, address, nodeInteraction, broadcast, waitForTx, balance, assetBalance, seedUtils, lease, cancelLease} from "@waves/waves-transactions"

import Web3 from 'web3';

class App extends Component {
  nodeUrl =  "http://127.0.0.1:6869"
  wvs = 100000000
  chainId = 'T'
  web3 = null
  contract = null
  constructor(props) {
    super(props)
    this.state = {
      wavesSusyContract: "3MLRN3PtLwFkkdSHzj2jcV3nh13Dqvoboeq",
      wavesSusyContractData: {},
      dataOther: {},
      ethEventsNewRq: []
    }
    this.updateData()
    setInterval(() => this.updateData(), 600);
    if (window.web3) {
      let jsonContract = require('./Supersymmetry.json');
      this.web3 = new Web3(window.web3.currentProvider);
      this.contract = new this.web3.eth.Contract(jsonContract, "0xDF530386f1073F482F1Aaf8EcE20fffEeE655f36")
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
    
    let tokenJsonContract = require('./Token.json');
    let ercToken = await this.contract.methods.tokenAddress().call()
    let ercContract = new this.web3.eth.Contract(tokenJsonContract, ercToken)
    let ethAccount = (await this.web3.eth.getAccounts())[0]
    let other = {
      address : address,
      ethAccount: ethAccount,
      balance : await nodeInteraction.assetBalance(this.state.wavesSusyContractData.asset_id, address, this.nodeUrl),
      ethBalance: (await ercContract.methods.balanceOf(ethAccount).call())/10000000000
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
        requests.push(
          <div id="solid">
            {event.id} | {" "}
            {status} | {" "}
            {type} | { " " }
            {event.target} | { " " }
            {this.web3.utils.fromWei(event.tokenAmount)} | 
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
    await window.WavesKeeper.signAndPublishTransaction({
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
    }).then((tx) => {
      console.log(tx);
      this.setState({lastTxHash: JSON.parse(tx).id })
    }).catch((error) => {
      alert("Что-то пошло не так", error);
    });
  }
  unlock = async () => {
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
                  value: this.state.ethSender
                },
                {
                  type: "integer",
                  value: this.state.unlockAmount * this.wvs
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

  burn = async() => {
    console.log(this.state.burnAmount)
    console.log(this.web3.utils.toWei(String(this.state.burnAmount), 'ether'))
    await this.contract.methods.createBurnRequest(this.state.burnRecipient, this.web3.utils.toWei(String(this.state.burnAmount), 'ether')).send({from: this.state.dataOther.ethAccount})
  }

  async mint(owner, amount) {
    await this.contract.methods.createMintRequest(owner, this.web3.utils.toWei(String(amount), 'ether')).send({from: this.state.dataOther.ethAccount})
  }


  render() {
    return (
      <div className="App">
         LastTxHash: {this.state.lastTxHash} | {' '}
        {this.state.dataOther.balance/this.wvs} Waves Token | {' '}
        {this.state.dataOther.ethBalance/this.wvs} Ethereum Token | {' '}
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
          <div>
            <h3>Fauset</h3>
            <button type="submit" onClick={this.testFaucet}>Get Token</button>
          </div>
          <div>
            <h3>Waves requests</h3>
            {this.getRequests("NEW")}
          </div>
          <div>
            <h3>Waves request history</h3>
            {this.getRequests("SUCCESS")}
          </div>
          <div>
            <h3>Ethereum requests</h3>
            {this.getEthRequests("NEW")}
          </div>
          <div>
            <h3>Ethereum request history</h3>
            {this.getEthRequests("SUCCESS")}
          </div>
          <div>
              <h3>Waves SUSY validators</h3>
              Reqest id: <input type="text" value={this.state.wavesRequestId} onChange={(event) => this.setState({ wavesRequestId: event.target.value })} />
              <div className="radio">
                  <label>
                  <input type="radio" checked={this.state.wavesRequestStatus === 3}  onChange={() => this.setState({ wavesRequestStatus: 3 })}/>
                    Accept
                  </label>
                   <label>
                   <input type="radio" checked={this.state.wavesRequestStatus === 2}  onChange={() => this.setState({ wavesRequestStatus: 2  })}/>
                    Reject
                  </label>
                  <button type="submit" onClick={this.changeStatusTest}>Change</button>
              </div>
          </div>

          <div>
              <h3>Ethereum SUSY validators</h3>
              Reqest id: <input type="text" value={this.state.ethRequestId} onChange={(event) => this.setState({ ethRequestId: event.target.value })} />
              <div className="radio">
                  <label>
                  <input type="radio" checked={this.state.ethRequestStatus === 3}  onChange={() => this.setState({ ethRequestStatus: 3 })}/>
                    Accept
                  </label>
                   <label>
                   <input type="radio" checked={this.state.ethRequestStatus === 2}  onChange={() => this.setState({ ethRequestStatus: 2  })}/>
                    Reject
                  </label>
                  <button type="submit" onClick={this.changeEthStatusTest}>Change</button>
              </div>
          </div>
        </div>
        </div>
    );
  }
}

export default App;
