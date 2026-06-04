export function formatIpa(phoneme) {
  const mark = phoneme.isStressed ? 'ˈ' : phoneme.isSecondaryStress ? 'ˌ' : ''
  return `${mark}${phoneme.ipa}`
}
