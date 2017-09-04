pragma solidity ^0.4.4;

contract Splitter {
	
	mapping(address => uint) public balances;

	event LogSplitPerformed(address sender, address receiver1, address receiver2, uint amountEachReceived, uint remainder);
	event LogFundsWithdrawn(address withdrawer, uint amount);

	function split(address receiver1, address receiver2) public payable returns (bool success) {
		require(msg.value > 0);
		require(receiver1 != 0);
		require(receiver2 != 0);

		uint splitAmount = msg.value / 2;
		uint remainder = 0;
		if (msg.value % 2 == 1) {
			remainder = 1;
		}
		
		balances[receiver1] += splitAmount;
		balances[receiver2] += splitAmount;
		balances[msg.sender] += remainder;

		LogSplitPerformed(msg.sender, receiver1, receiver2, splitAmount, remainder);
		
		return true;
	}

	function withdraw() public returns(bool success) {
		uint amount = balances[msg.sender];
		require(amount > 0);

		balances[msg.sender] = 0;
		msg.sender.transfer(amount);

		LogFundsWithdrawn(msg.sender, amount);

		return true;
	}
}
