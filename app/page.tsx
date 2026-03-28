export default function Home() {
  return (
    <script dangerouslySetInnerHTML={{ __html: `window.location.replace('/auth/login')` }} />
  )
}
