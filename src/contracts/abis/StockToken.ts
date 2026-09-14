// ERC-8056 stock token (ERC-20 + UI multiplier). PLACEHOLDER — replace with the issuer ABI.
export const stockTokenAbi = [
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  // ERC-8056
  { type: 'function', name: 'uiMultiplier', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'newUIMultiplier', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'effectiveAt', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
] as const
