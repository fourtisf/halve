// PLACEHOLDER ABI — replace with the compiled MultiplierAccountant ABI.
// Function names follow CLAUDE.md § Contract reads. The checkpoint struct layout,
// `checkpointCount()` and the `kind` enum are assumptions to be confirmed.
export const multiplierAccountantAbi = [
  { type: 'function', name: 'isSynced', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bool' }] },
  // 1e18 = 1.0
  { type: 'function', name: 'dividendIndex', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  // 1e18 = 1.0
  { type: 'function', name: 'splitFactor', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'dividendIndexAt', stateMutability: 'view', inputs: [{ name: 'ts', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'checkpointCount', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  {
    type: 'function', name: 'checkpointAt', stateMutability: 'view',
    inputs: [{ name: 'i', type: 'uint256' }],
    outputs: [
      { name: 'ts', type: 'uint64' },
      // 0 = Dividend, 1 = Split, 2 = Special dividend (guardian-classified)
      { name: 'kind', type: 'uint8' },
      // ratio applied at this checkpoint, 1e18 = 1.0
      { name: 'ratio', type: 'uint256' },
      // dividendIndex after this checkpoint, 1e18 = 1.0
      { name: 'indexAfter', type: 'uint256' },
    ],
  },
  {
    type: 'function', name: 'pending', stateMutability: 'view', inputs: [],
    outputs: [
      { name: 'exists', type: 'bool' },
      // timestamp the pending action was queued at; executable at ts + TIMELOCK
      { name: 'ts', type: 'uint64' },
      { name: 'oldMultiplier', type: 'uint256' },
      { name: 'newMultiplier', type: 'uint256' },
    ],
  },
] as const
