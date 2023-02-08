export class TypeIsUndefinedError extends Error {
  constructor() {
    super('Specify a type');
    this.name = 'Type is undefined';
  }
}

export class TypeIsNotSetError extends Error {
  constructor() {
    super('Add a type');
    this.name = 'Type is not set';
  }
}

export class TakerNotDefinedError extends Error {
  constructor() {
    super('Specify a taker');
    this.name = 'Taker is undefined';
  }
}

export class MakerNotDefinedError extends Error {
  constructor() {
    super('Specify a maker');
    this.name = 'Maker is undefined';
  }
}

export class InvalidAddressError extends Error {
  constructor(field) {
    super(`Provide a valid address: ${field}`);
    this.name = 'Address is invalid';
  }
}

export class MissingRequiredFieldError extends Error {
  constructor(field) {
    super(`Provide this field: ${field}`);
    this.name = 'Field is missing';
  }
}

export class InvalidNonceError extends Error {
  constructor() {
    super('Provide correct nonce value');
    this.name = 'Invalid nonce value';
  }
}
export class MissingNonceError extends Error {
  constructor() {
    super('Specify a nonce');
    this.name = 'Nonce Missed';
  }
}

export class InvalidErc20TokenAmount extends Error {
  constructor() {
    super('Provide correct erc20 token amount value');
    this.name = 'Invalid erc20 token amount';
  }
}

export class InvalidErc20Token extends Error {
  constructor() {
    super('Provide correct erc20 token value');
    this.name = 'Invalid erc20 token';
  }
}

export class InvalidErc721Token extends Error {
  constructor() {
    super('Provide correct erc721 token value');
    this.name = 'Invalid erc721 token';
  }
}

export class InvalidErc721TokenId extends Error {
  constructor() {
    super('Provide correct erc721 token id');
    this.name = 'Invalid erc721 token id';
  }
}

export class InvalidExpiry extends Error {
  constructor() {
    super('Provide correct expiry');
    this.name = 'Invalid expiry';
  }
}

export class InvalidNftColorId extends Error {
  constructor() {
    super('Provide correct nft color id');
    this.name = 'Invalid nft color id';
  }
}

export class InvalidTransactionHash extends Error {
  constructor() {
    super('Provide correct transaction hash');
    this.name = 'Invalid transaction hash';
  }
}

export class InvalidMakingHash extends Error {
  constructor() {
    super('Provide correct making hash');
    this.name = 'Invalid making hash';
  }
}

export class InvalidAcceptingHash extends Error {
  constructor() {
    super('Provide correct accepting hash');
    this.name = 'Invalid accepting hash';
  }
}

export class InvalidCancelHash extends Error {
  constructor() {
    super('Provide correct cancelling hash');
    this.name = 'Invalid cancelling hash';
  }
}

export class UnexpectedError extends Error {
  constructor() {
    super('An unexpected error occured');
    this.name = 'Unexpected error';
  }
}

export class InvalidOrderId extends Error {
  constructor() {
    super('Provide correct order id');
    this.name = 'Invalid Order Id';
  }
}

export class InvalidCurrent extends Error {
  constructor() {
    super('Provide correct current value');
    this.name = 'Invalid current value';
  }
}
export class CurrentIsImmutable extends Error {
  constructor() {
    super('You cannot change the current');
    this.name = 'Current value is immutable';
  }
}

export class InvalidCurrentChange extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'Invalid Current Change';
  }
}

export class InvalidTransaction extends Error {
  constructor() {
    super('This is not valid transaction.');
    this.name = 'faker attacks';
  }
}

export class InvalidOrder extends Error {
  constructor() {
    super('This is not valid order.');
    this.name = 'Invalid order';
  }
}

export class InvalidConfirm extends Error {
  constructor() {
    super('Not our presigned order.');
    this.name = 'Invalid confirmtransaction';
  }
}

export class DoesnotNeedFiled extends Error {
  constructor(field) {
    super(`${field} must be missed`);
    this.name = "Field doesn't needed";
  }
}

export class SignatureError extends Error {
  constructor() {
    super(`Something was wrong at signature`);
    this.name = "signature error";
  }
}

export class DirectionIsUndefinedError extends Error {
  constructor() {
    super('Specify a Direction');
    this.name = 'Direction is undefined';
  }
}

export class SignatureFailedError extends Error {
  constructor() {
    super('Signature Failed');
    this.name = 'Signature Failed';
  }
}
export class MissingSignatureError extends Error {
  constructor() {
    super('Speciay a Signature');
    this.name = 'Signature Missed';
  }
}

export class MissingCancelHashError extends Error {
  constructor() {
    super('Speciay a CancelHash');
    this.name = 'CancelHash Missed';
  }
}