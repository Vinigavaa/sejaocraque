'use client'

import { DesktopShell } from '@/components/DesktopShell'
import { ScreenTransition } from '@/components/motion'
import { Overlays } from '@/components/Overlays'
import { Agent } from '@/components/screens/Agent'
import { Career } from '@/components/screens/Career'
import { ClubStart } from '@/components/screens/ClubStart'
import { Create } from '@/components/screens/Create'
import { Draft } from '@/components/screens/Draft'
import { End } from '@/components/screens/End'
import { History } from '@/components/screens/History'
import { Home } from '@/components/screens/Home'
import { Live } from '@/components/screens/Live'
import { Market } from '@/components/screens/Market'
import { LiveMatch } from '@/components/screens/LiveMatch'
import { Reveal } from '@/components/screens/Reveal'
import { SeasonReview } from '@/components/screens/SeasonReview'
import { useGame } from '@/lib/game/useGame'
import { t } from '@/lib/ui/theme'

export default function Page() {
  const game = useGame()

  return (
    <main style={{ minHeight: '100dvh', background: t.bg, color: t.text }}>
      <DesktopShell game={game}>
        <ScreenTransition screen={game.screen}>
          {game.screen === 'home' && <Home onPlay={() => game.setScreen('create')} />}
          {game.screen === 'create' && <Create game={game} />}
          {game.screen === 'draft' && <Draft game={game} />}
          {game.screen === 'reveal' && <Reveal game={game} />}
          {game.screen === 'club' && <ClubStart game={game} />}
          {game.screen === 'match' && <LiveMatch game={game} />}
          {game.screen === 'live' && <Live game={game} />}
          {game.screen === 'review' && <SeasonReview game={game} />}
          {game.screen === 'career' && <Career game={game} />}
          {game.screen === 'end' && <End game={game} />}
          {game.screen === 'history' && <History game={game} />}
          {game.screen === 'agent' && <Agent game={game} />}
          {game.screen === 'market' && <Market game={game} />}
        </ScreenTransition>
      </DesktopShell>

      <Overlays game={game} />
    </main>
  )
}
