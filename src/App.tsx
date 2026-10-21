import AppHeader from './components/AppHeader.tsx'
import StartScreen from './components/StartScreen.tsx'

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <StartScreen />
    </div>
  )
}
