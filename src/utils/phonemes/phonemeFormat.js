export function formatIpa(phoneme) {
  return `${phoneme.isStressed ? 'ˈ' : ''}${phoneme.ipa}`
}
