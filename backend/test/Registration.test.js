const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Registration", function () {
  let token, winterSchool;
  let owner, participant1, participant2;
  const initialFee = ethers.parseUnits("100", 0);
  const initialFee50 = ethers.parseUnits("150", 0);
  const initialFee100 = ethers.parseUnits("200", 0);
  const initialFeePro = ethers.parseUnits("1000", 0);
  const initialFeePro100 = ethers.parseUnits("1100", 0);
  const initialFeePro500 = ethers.parseUnits("1500", 0);

  async function setup() {
    [owner, participant1, participant2] = await ethers.getSigners();

    // Deploy the SimplifiedERC20 token contract
    const ERC20Factory = await ethers.getContractFactory("LXBWS");
    token = await ERC20Factory.deploy();
    await token.waitForDeployment();
    console.log("Token deployed at", token.target);

    // Mint tokens for participants
    await token.mint(participant1.address, ethers.parseUnits("100", 0));
    await token.mint(participant2.address, ethers.parseUnits("1000", 0));

    // Deploy the Registration contract with the token address and initial fee
    const WinterSchoolFactory = await ethers.getContractFactory("Registration");

    const currentTimestamp = Date.now();
    //console.log([currentTimestamp + 100000, currentTimestamp + 200000, currentTimestamp + 300000]);
    winterSchool = await WinterSchoolFactory.deploy(token.target, 
      [currentTimestamp + 100000, currentTimestamp + 200000, currentTimestamp + 300000], 
      [[initialFee, initialFeePro], [initialFee50, initialFeePro100], [initialFee100, initialFeePro500]]
    );
    //console.log([[initialFee, initialFeePro], [initialFee50, initialFeePro100], [initialFee100, initialFeePro500]]);
    await winterSchool.waitForDeployment();
    console.log("WinterSchool deployed at", winterSchool.target);

    return { token, winterSchool, owner, participant1, participant2 };
  };

  it("should register a Student successfully", async function () {
    const { winterSchool, participant1 } = await loadFixture(setup);
    // Approve tokens for spending by the winterSchool contract
    await token.connect(participant1).approve(winterSchool.target, initialFee);

    // Call register and verify the event is emitted
    await expect(winterSchool.connect(participant1).register(0))
      .to.emit(winterSchool, "ParticipantRegistered")
      .withArgs(participant1.address, 0, 0, initialFee, await time.latest() + 1);

    // Check registration status
    expect(await winterSchool.isRegistered(participant1.address)).to.be.true;

    // Check the balance of the winterSchool contract
    expect(await token.balanceOf(winterSchool.target)).to.equal(initialFee);
  });

  it("should not register Professional successfully because of insufficient balance", async function () {
    const { winterSchool, participant1 } = await loadFixture(setup);
    // Approve tokens for spending by the winterSchool contract
    await token.connect(participant1).approve(winterSchool.target, initialFeePro);

    // Call register and verify the event is emitted
    await expect(winterSchool.connect(participant1).register(1)).to.be.revertedWith("Insufficient balance");

    // Check registration status
    expect(await winterSchool.isRegistered(participant1.address)).to.be.false;

    // Check the balance of the winterSchool contract
    expect(await token.balanceOf(winterSchool.target)).to.equal(0);
  });

  it("should not register student because time expired", async function () {
    const { winterSchool, participant1 } = await loadFixture(setup);
    // Approve tokens for spending by the winterSchool contract
    await token.connect(participant1).approve(winterSchool.target, initialFeePro);

    // We can increase the time in Hardhat Network
    await time.increaseTo(Date.now() + 100000 + 1);

    // Call register and verify the event is emitted
    await expect(winterSchool.connect(participant1).register(1)).to.be.revertedWith("Insufficient balance");

    // Check registration status
    expect(await winterSchool.isRegistered(participant1.address)).to.be.false;

    // Check the balance of the winterSchool contract
    expect(await token.balanceOf(winterSchool.target)).to.equal(0);
  });

  it("should register student in the second slot", async function () {
    const { winterSchool, participant1 } = await loadFixture(setup);
    // Mint tokens for participant1
    await token.mint(participant1.address, ethers.parseUnits("100", 0));

    // Approve tokens for spending by the winterSchool contract
    await token.connect(participant1).approve(winterSchool.target, initialFee50);

    // We can increase the time in Hardhat Network
    await time.increaseTo(Date.now() + 100000);

    const currentTime = await time.latest();
    // Call register and verify the event is emitted
    await expect(winterSchool.connect(participant1).register(0))
    .to.emit(winterSchool, "ParticipantRegistered")
    .withArgs(participant1.address, 0, 1, initialFee50, currentTime +1 );

    // Check registration status
    expect(await winterSchool.isRegistered(participant1.address)).to.be.true;

    // Check the balance of the winterSchool contract
    expect(await token.balanceOf(winterSchool.target)).to.equal(initialFee50);
  });

  it("should fail registration if allowance is insufficient", async function () {
    const { winterSchool, participant1 } = await loadFixture(setup);
    // No approval is given for participant1
    await expect(winterSchool.connect(participant1).register(0))
      .to.be.revertedWith("Allowance exceeded");
  });

  it("should allow the organizer to update the registration fee", async function () {
    const { winterSchool } = await loadFixture(setup);
    const newFee = ethers.parseUnits("200", 18);
    await expect(winterSchool.updateRegistrationFee(newFee, 0, 0))
      .to.emit(winterSchool, "RegistrationFeeUpdated")
      .withArgs(newFee, 0, 0);

    expect(await winterSchool.registrationFee()).to.equal(newFee);
  });

  it("should prevent non-organizers from updating the registration fee", async function () {
    const { winterSchool, participant1 } = await loadFixture(setup);
    const newFee = ethers.parseUnits("200", 18);
    await expect(winterSchool.connect(participant1).updateRegistrationFee(newFee, 0, 0))
      .to.be.revertedWith("Only the organizer can perform this action");
  });

  it("should not allow double registration", async function () {
    const { winterSchool, participant1, } = await loadFixture(setup);
    await token.connect(participant1).approve(winterSchool.target, initialFee);
    await winterSchool.connect(participant1).register(0);

    
    await expect(winterSchool.connect(participant1).register(0))
      .to.be.revertedWith("Already registered");
  });
});
