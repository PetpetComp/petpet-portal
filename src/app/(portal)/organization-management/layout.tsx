/**
 * Semua akun yang login boleh membuka Organizations: daftar organisasi bersifat publik di
 * backend dan akun biasa perlu halaman ini untuk "Apply as organizer". Isi tiap bagian
 * mengikuti hak akun (lihat `domains/organizations/access.ts`), jadi tidak ada penjaga halaman.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
