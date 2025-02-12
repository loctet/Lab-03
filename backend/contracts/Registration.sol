// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "./IERC20.sol";

contract Registration {
    IERC20 private _token;
    address private _organizer;
    enum RegistrationType {Student, Professional, Participant}
    uint private _numberOfStages;
    mapping(uint => uint256) private _registrationStages;
    // Mapping from registration type to registration fee stage -> type -> fee
    mapping(uint => mapping(uint256 => uint256)) private _registrationFee;

    mapping(address => bool) private _registered;

    event ParticipantRegistered(address indexed participant, uint256 indexed typeRegistration, uint256 indexed registrationStage, uint256 fee, uint256  timestamp);
    event RegistrationFeeUpdated(uint256 indexed newFee, uint256 indexed typeRegistration, uint256 indexed registrationStage);

    // Modifier to restrict access to the organizer only
    modifier onlyOrganizer() {
        require(msg.sender == _organizer, "Only the organizer can perform this action");
        _;
    }

    // Initialize the contract with the ERC20 token contract address and the registration fee
    constructor(IERC20 token, uint256[] memory registrationStages,  uint256[][] memory registrationFee) {
        _token = token;
        _organizer = msg.sender;
        for(uint i; i < registrationStages.length; i++) {
            _registrationStages[i] = registrationStages[i];
            for(uint j; j < registrationFee[i].length; j++) {
                _registrationFee[i][j] = registrationFee[i][j];
            }
        }
        _numberOfStages = registrationStages.length;
    }

    /**
     * @dev Returns the address of the LXBWS token
     */
    function token() public view virtual returns (IERC20) {
        return _token;
    }

    /**
     * @dev Returns the address of the event organizer
     */
    function organizer() public view virtual returns (address) {
        return _organizer;
    }

    /**
     * @dev Returns the current registration fee set by the organizer
     */
    function registrationFee() public view virtual returns (uint256) {
        return _registrationFee[registrationStage()][0];
    }

    function registrationStage() public view returns (uint256) {
        uint256 currentStage = _numberOfStages;
        for(uint256 i; i < _numberOfStages; i++) {
            if(_registrationStages[i] >= block.timestamp) {
                currentStage = i;
                break;
            }
        }
        return currentStage;
    }

    function registrationFeeType(uint256 typeRegistration) public view returns (uint256) {
        uint256 currentStage = registrationStage();
        return _registrationFee[currentStage][typeRegistration];
    }

    // Register a participant by transferring ERC20 tokens as a fee.
    // Make sure the participant has approved this contract to spend their tokens.
    // Emit the corresponding event if the registration is successful.

    /**
     * @dev Should register 'msg.sender' in the event. Includes updating the
     * 'registered' mapping and emitting the 'ParticipantRegistered' event.
     * Must transfer the registration fee in LxBWS tokens from the participant to
     * this contract.
     */
    function register(uint256 typeRegistration) external {
        require( registrationStage() < _numberOfStages, "Registration stage has passed");
        uint256 registrationFee_ = registrationFeeType(typeRegistration);
        require(!_registered[msg.sender], "Already registered");
        require(_token.balanceOf(msg.sender) >= registrationFee_, "Insufficient balance");
        
        _token.transferFrom(msg.sender, address(this), registrationFee_);
        _registered[msg.sender] = true;

        emit ParticipantRegistered(msg.sender, typeRegistration, registrationStage(), registrationFee_, block.timestamp);
    }

    /**
     * @dev Should allow the organizer to update the registration fee. Must emit
     * the 'RegistrationFeeUpdated' event.
     */
    function updateRegistrationFee(uint256 newFee, uint256 typeRegistration, uint256 registrationStage) external onlyOrganizer {
        // can only update if not passed 
        require(_registrationStages[registrationStage] >= block.timestamp, "Registration stage has passed");
        require(newFee > 0 && _registrationFee[registrationStage][typeRegistration] <= newFee, "Invalid fee");
        _registrationFee[registrationStage][typeRegistration] = newFee;
        emit RegistrationFeeUpdated(newFee, typeRegistration, registrationStage);
    }

    /**
     * @dev Allows to check if a participant is registered in the event.
     */
    function isRegistered(address participant) external view returns (bool) {
        return _registered[participant];
    }
}
