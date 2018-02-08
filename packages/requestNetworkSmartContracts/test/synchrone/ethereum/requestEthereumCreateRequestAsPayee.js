var config = require("../../config.js"); var utils = require("../../utils.js");
if(!config['all'] && !config[__filename.split('\\').slice(-1)[0]]) {
	return;
}

var RequestCore = artifacts.require("./core/RequestCore.sol");
var RequestEthereum = artifacts.require("./synchrone/RequestEthereum.sol");
var RequestBurnManagerSimple = artifacts.require("./collect/RequestBurnManagerSimple.sol");

var BigNumber = require('bignumber.js');


contract('RequestEthereum createRequestAsPayee',  function(accounts) {
	var admin = accounts[0];
	var otherguy = accounts[1];
	var fakeContract = accounts[2];
	var payer = accounts[3];
	var payee = accounts[4];
	var payee2 = accounts[5];
	var payee3 = accounts[6];

	var requestCore;
	var requestEthereum;

	var arbitraryAmount = 1000;
	var arbitraryAmount2 = 200;
	var arbitraryAmount3 = 300;

    beforeEach(async () => {
		requestCore = await RequestCore.new();
		var requestBurnManagerSimple = await RequestBurnManagerSimple.new(0); 
		await requestBurnManagerSimple.setFeesPerTenThousand(100);// 1% collect
		await requestCore.setBurnManager(requestBurnManagerSimple.address, {from:admin});
		
    	requestEthereum = await RequestEthereum.new(requestCore.address,{from:admin});

		await requestCore.adminAddTrustedCurrencyContract(requestEthereum.address, {from:admin});
    });



	it("new request OK", async function () {
		var r = await requestEthereum.createRequestAsPayee([payee,payee2,payee3], [arbitraryAmount,arbitraryAmount2,arbitraryAmount3], payer, "", {from:payee});

		var l = utils.getEventFromReceipt(r.receipt.logs[0], requestCore.abi);
		assert.equal(l.name,"Created","Event Created is missing after createRequestAsPayee()");
		assert.equal(r.receipt.logs[0].topics[1],utils.getRequestId(requestCore.address, 1),"Event Created wrong args requestId");
		assert.equal(utils.bytes32StrToAddressStr(r.receipt.logs[0].topics[2]).toLowerCase(),payee,"Event Created wrong args payee");
		assert.equal(utils.bytes32StrToAddressStr(r.receipt.logs[0].topics[3]).toLowerCase(),payer,"Event Created wrong args payer");
		assert.equal(l.data[0].toLowerCase(),payee,"Event Created wrong args creator");
		assert.equal(l.data[1],'',"Event Created wrong args data");

		var l = utils.getEventFromReceipt(r.receipt.logs[1], requestCore.abi);
		assert.equal(l.name,"NewSubPayee","Event NewSubPayee is missing after createRequestAsPayee()");
		assert.equal(r.receipt.logs[1].topics[1],utils.getRequestId(requestCore.address, 1),"Event NewSubPayee wrong args requestId");
		assert.equal(utils.bytes32StrToAddressStr(r.receipt.logs[1].topics[2]).toLowerCase(),payee2,"Event NewSubPayee wrong args subPayee");

		var l = utils.getEventFromReceipt(r.receipt.logs[2], requestCore.abi);
		assert.equal(l.name,"NewSubPayee","Event NewSubPayee is missing after createRequestAsPayee()");
		assert.equal(r.receipt.logs[2].topics[1],utils.getRequestId(requestCore.address, 1),"Event NewSubPayee wrong args requestId");
		assert.equal(utils.bytes32StrToAddressStr(r.receipt.logs[2].topics[2]).toLowerCase(),payee3,"Event NewSubPayee wrong args subPayee");

		var r = await requestCore.requests.call(utils.getRequestId(requestCore.address, 1));
		assert.equal(r[0],payer,"request wrong data : payer");
		assert.equal(r[1],requestEthereum.address,"new request wrong data : currencyContract");
		assert.equal(r[2],0,"new request wrong data : state");
		assert.equal(r[3],0,"new request wrong data : extension");
		assert.equal(r[4],payee,"request wrong data : payee");
		assert.equal(r[5],arbitraryAmount,"request wrong data : expectedAmount");
		assert.equal(r[6],0,"new request wrong data : balance");

		var count = await requestCore.getSubPayeesCount.call(utils.getRequestId(requestCore.address,1));
		assert.equal(count,2,"number of subPayee wrong");

		var r = await requestCore.subPayees.call(utils.getRequestId(requestCore.address, 1),0);	
		assert.equal(r[0],payee2,"request wrong data : payer");
		assert.equal(r[1],arbitraryAmount2,"new request wrong data : expectedAmount");
		assert.equal(r[2],0,"new request wrong data : balance");

		var r = await requestCore.subPayees.call(utils.getRequestId(requestCore.address, 1),1);	
		assert.equal(r[0],payee3,"request wrong data : payer");
		assert.equal(r[1],arbitraryAmount3,"new request wrong data : expectedAmount");
		assert.equal(r[2],0,"new request wrong data : balance");
	});


	it("basic check on payee payer creator", async function () {
		// new request payer==0 OK
		await utils.expectThrow(requestEthereum.createRequestAsPayee([payee,payee2,payee3], [arbitraryAmount,arbitraryAmount2,arbitraryAmount3], 0, "", {from:payee}));
		// new request payee==payer impossible
		await utils.expectThrow(requestEthereum.createRequestAsPayee([payer,payee2,payee3], [arbitraryAmount,arbitraryAmount2,arbitraryAmount3], payer, "", {from:payee}));
	});

	it("basic check on expectedAmount", async function () {
		// new request _expectedAmount >= 2^256 impossible
		await utils.expectThrow(requestEthereum.createRequestAsPayee([payee,payee2,payee3], [new BigNumber(2).pow(256),arbitraryAmount2,arbitraryAmount3], payer, "", {from:payee}));
	});

	it("impossible to createRequest if Core Paused", async function () {
		await requestCore.pause({from:admin});
		await utils.expectThrow(requestEthereum.createRequestAsPayee([payee,payee2,payee3], [arbitraryAmount,arbitraryAmount2,arbitraryAmount3], payer, "", {from:payee}));
	});

	it("new request when currencyContract not trusted Impossible", async function () {
		var requestEthereum2 = await RequestEthereum.new(requestCore.address,{from:admin});
		await utils.expectThrow(requestEthereum2.createRequestAsPayee([payee,payee2,payee3], [arbitraryAmount,arbitraryAmount2,arbitraryAmount3], payer, "", {from:payee}));
	});
});
