let Splitter = artifacts.require("./Splitter.sol");

require('bluebird').promisifyAll(web3.eth, { suffix: "Promise" });

contract('Splitter', function(accounts) {
  let splitterInstance;
  const sender = accounts[0];
  const recipient1 = accounts[1];
  const recipient2 = accounts[2];

  before("check that prerequisites for tests are valid", function() {
    const accountsToCheck = [0, 1, 2, 3];
    accountsToCheck.forEach(function (accountNumber) {
      assert.isDefined(accounts[accountNumber], `"accounts[${accountNumber}] is undefined`);
      web3.eth.signPromise(accounts[accountNumber], "someData")
      .catch((error) => {
        assert.fail(`"accounts[${accountNumber}] is not unlocked`);
      });
      web3.eth.getBalancePromise(accounts[accountNumber])
      .then((balance) => {
        assert.isTrue(balance.greaterThan(web3.toWei(1, 'ether')), `"accounts[${accountNumber}] insufficient balance`)
      });
    });
  });

  beforeEach("create a new Splitter contract instance", function() {
    return Splitter.new()
    .then(instance => {
      splitterInstance = instance;
    });
  });

  describe("split", () => {
    it("should throw if the value sent is 0", function() {
      return splitterInstance.split(recipient1, recipient2, {
        from: sender,
        value: 0
      })
      .then(() => {
        assert.fail("split was successful, but it should have thrown");
      })
      .catch((error) => {
        assert.isTrue(error.message.includes("invalid opcode"))
      });
    });
    
    it("should throw if receiver1 address is not sent", () => {
      return splitterInstance.split("0x0", recipient2, {
        from: sender,
        value: 100
      })
      .then(() => {
        assert.fail("split was successful, but it should have thrown");
      })
      .catch((error) => {
        assert.isTrue(error.message.includes("invalid opcode"))
      });
    }); 

    it("should throw if receiver2 address is not sent", () => {
      return splitterInstance.split(recipient1, "0x0", {
        from: sender,
        value: 100
      })
      .then(() => {
        assert.fail("split was successful, but it should have thrown");
      })
      .catch((error) => {
        assert.isTrue(error.message.includes("invalid opcode"))
      });
    }); 

    it("should split evenly without a remainder for an even wei amount", () => {
      return splitterInstance.split.call(recipient1, recipient2, {
        from: sender,
        value: 100
      })
      .then(result => {
        assert.isTrue(result);
        return splitterInstance.split(recipient1, recipient2, {
          from: sender,
          value: 100
        })
      })
      .then(txn => {
        assert.equal(txn.logs.length, 1);
        let logSplitPerformed = txn.logs[0];
        assert.equal(logSplitPerformed.event, "LogSplitPerformed");
        assert.equal(logSplitPerformed.args.sender, sender);
        assert.equal(logSplitPerformed.args.receiver1, recipient1);
        assert.equal(logSplitPerformed.args.receiver2, recipient2);
        assert.equal(logSplitPerformed.args.amountEachReceived, 50);
        assert.equal(logSplitPerformed.args.remainder, 0);

        return splitterInstance.balances(recipient1);
      })
      .then(balanceRecipient1 => {
        assert.equal(balanceRecipient1, 50)
        return splitterInstance.balances(recipient2);
      })
      .then(balanceRecipient2 => {
        assert.equal(balanceRecipient2, 50)
        return splitterInstance.balances(sender);
      })
      .then(balanceSender => {
        assert.equal(balanceSender, 0)
        return web3.eth.getBalancePromise(splitterInstance.address);
      })
      .then((balanceContract) => {
        assert.strictEqual(balanceContract.toString(10), "100");
      })
    });
    
    it("should split evenly leaving remainder to sender for an odd wei amount", () => {
      return splitterInstance.split.call(recipient1, recipient2, {
        from: sender,
        value: 101
      })
      .then(result => {
        assert.isTrue(result);
        return splitterInstance.split(recipient1, recipient2, {
          from: sender,
          value: 101
        })
      })
      .then(txn => {
        assert.equal(txn.logs.length, 1);
        var logSplitPerformed = txn.logs[0];
        assert.equal(logSplitPerformed.event, "LogSplitPerformed");
        assert.equal(logSplitPerformed.args.sender, sender);
        assert.equal(logSplitPerformed.args.receiver1, recipient1);
        assert.equal(logSplitPerformed.args.receiver2, recipient2);
        assert.equal(logSplitPerformed.args.amountEachReceived, 50);
        assert.equal(logSplitPerformed.args.remainder, 1);

        return splitterInstance.balances(recipient1);
      })
      .then(balanceRecipient1 => {
        assert.equal(balanceRecipient1, 50)
        return splitterInstance.balances(recipient2);
      })
      .then(balanceRecipient2 => {
        assert.equal(balanceRecipient2, 50)
        return splitterInstance.balances(sender);
      })
      .then(balanceSender => {
        assert.equal(balanceSender, 1)
        return web3.eth.getBalancePromise(splitterInstance.address);
      })
      .then((balanceContract) => {
        assert.strictEqual(balanceContract.toString(10), "101");
      })
    }); 
  });

  describe("withdraw", () => {
    let recipient1InitialBalance;
    let withdrawalTransactionCost;
    let gasPrice;

    before("get current gas price", function() {
      return web3.eth.getGasPricePromise()
      .then(currentGasPrice => {
        gasPrice = currentGasPrice;
      });
    });

    it("should throw if the requester has a balance of 0", () => {
      return splitterInstance.withdraw({
        from: accounts[3],
      })
      .then(() => {
        assert.fail("withdraw was successful, but it should have thrown");
      })
      .catch((error) => {
        assert.isTrue(error.message.includes("invalid opcode"))
      });
    });

    it("should withdraw full balance (minus cost of gas) for requester, and leave other balances unaffected", () => {
      return web3.eth.getBalancePromise(recipient1)
      .then((balance) => {
        recipient1InitialBalance = balance;
      })
      .then(() => {
        return splitterInstance.split(recipient1, recipient2, {
          from: sender,
          value: 101
        });
      })
      .then(() => {
        return splitterInstance.withdraw.call({
          from: recipient1,
          gasPrice: gasPrice
        });
      })
      .then(result => {
        assert.isTrue(result);
        return splitterInstance.withdraw({
          from: recipient1,
          gasPrice: gasPrice
        });
      })
      .then(txn => {
        assert.equal(txn.logs.length, 1);
        let logFundsWithdrawn = txn.logs[0];
        assert.equal(logFundsWithdrawn.event, "LogFundsWithdrawn");
        assert.equal(logFundsWithdrawn.args.withdrawer, recipient1);
        assert.equal(logFundsWithdrawn.args.amount, 50);

        withdrawalTransactionCost = gasPrice * txn.receipt.gasUsed;
        return web3.eth.getBalancePromise(recipient1);
      })
      .then((balanceRecipient1) => {
        let expectedRecipient1FinalBalance = recipient1InitialBalance.minus(web3.toBigNumber(withdrawalTransactionCost)).plus(web3.toBigNumber(50));
        assert.strictEqual(balanceRecipient1.toString(10), expectedRecipient1FinalBalance.toString(10))
        return splitterInstance.balances(recipient1);
      })
      .then((balanceRecipient1InContract) => {
        assert.equal(balanceRecipient1InContract, 0)
        return splitterInstance.balances(recipient2);
      })
      .then((balanceRecipient2) => {
        assert.equal(balanceRecipient2, 50)
        return splitterInstance.balances(sender);
      })
      .then((balanceSender) => {
        assert.equal(balanceSender, 1)
        return web3.eth.getBalancePromise(splitterInstance.address);
      })
      .then((balanceContract) => {
        assert.strictEqual(balanceContract.toString(10), "51");
      })
    });
  });
});
