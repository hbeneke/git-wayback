export const siteConfig = {
  nickname: 'Habakuk Beneke',
  siteCreationYear: '2024',
  get copyrightYear() {
    return `${this.siteCreationYear}-${new Date().getFullYear().toString().slice(-2)}`
  },
}
