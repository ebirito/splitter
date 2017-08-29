let Splitter = artifacts.require("./Splitter.sol");

require('bluebird').promisifyAll(web3.eth, { suffix: "Promise" });

contract('Splitter', function(accounts) {
  let splitterInstance;
  const sender = accounts[0];
  const recipient1 = accounts[1];
  const recipient2 = accounts[2];

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
      return splitterInstance.split(recipient1, recipient2, {
        from: sender,
        value: 100
      })
      .then(txn => {
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
      })
    });
    
    it("should split evenly leaving remainder to sender for an odd wei amount", () => {
      return splitterInstance.split(recipient1, recipient2, {
        from: sender,
        value: 101
      })
      .then(txn => {
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
      })
    }); 
  });

  describe("withdraw", () => {
    let recipient1InitialBalance;
    let withdrawalTransactionCost;
    const gasPrice = 1;

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
        return splitterInstance.withdraw({
          from: recipient1,
          gasPrice: gasPrice
        });
      })
      .then(txn => {
        withdrawalTransactionCost = gasPrice * txn.receipt.gasUsed;
        return web3.eth.getBalancePromise(recipient1);
      })
      .then((balanceRecipient1) => {
        let expectedRecipient1FinalBalance = recipient1InitialBalance.minus(web3.toBigNumber(withdrawalTransactionCost)).plus(web3.toBigNumber(50));
        assert.deepEqual(balanceRecipient1, expectedRecipient1FinalBalance)
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
      });
    });
  });
});
