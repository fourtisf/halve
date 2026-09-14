// PLACEHOLDER ABI — replace with the compiled StripVault ABI from the contracts repo.
// Function names/args follow CLAUDE.md § Contract reads. Event shapes are assumptions.
export const stripVaultAbi = [
  { type: 'function', name: 'split', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'merge', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'settle', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'redeemPT', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'redeemYT', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'totalDeposits', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'cap', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  // dividend index at series start, 1e18 = 1.0
  { type: 'function', name: 'd0', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  // 0 = Active, 1 = Matured (settle() callable), 2 = Settled (redeem open). Assumption — verify against the contract.
  { type: 'function', name: 'state', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
  { type: 'function', name: 'maturity', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'event', name: 'Split', inputs: [
    { name: 'account', type: 'address', indexed: true },
    { name: 'amount', type: 'uint256', indexed: false },
    { name: 'fee', type: 'uint256', indexed: false },
  ] },
  { type: 'event', name: 'Merge', inputs: [
    { name: 'account', type: 'address', indexed: true },
    { name: 'amount', type: 'uint256', indexed: false },
  ] },
] as const
