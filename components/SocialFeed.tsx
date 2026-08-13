import type { Game } from '@/lib/game/useGame'
import { formatCount, type SocialAuthorKind, type SocialPost } from '@/lib/game/social'

import { Display, scaled, SectionLabel, t } from './shared'

/** Cor do selo de alcance — do sussurro local ao post que roda o mundo. */
const REACH_COLOR: Record<SocialPost['reach'], string> = {
  local: t.muted,
  nacional: t.accent,
  continental: t.gold,
  mundial: t.greenText,
}

const AVATAR: Record<SocialAuthorKind, string> = {
  jornalista: '📰',
  pagina: '⚽',
  torcedor: '🙋',
  mercado: '💰',
  oficial: '🛡️',
}

/**
 * A rede social da carreira, em popup.
 *
 * Mesmo tratamento visual do resto do jogo (`t.card`, backdrop fixo, cantos
 * de 10px) — o pedido era uma timeline "integrada visualmente" ao jogo, e nao
 * uma tela emprestada de outro produto. `game.social` ja chega filtrado pela
 * temporada atual: este componente so lista o que recebe.
 */
export function SocialFeed({ game, onClose }: { game: Game; onClose: () => void }) {
  const posts = game.social

  return (
    <div
      data-motion="backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'oklch(5% 0 0 / 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: scaled(24),
        zIndex: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          background: t.card,
          borderRadius: 10,
          width: '100%',
          maxWidth: scaled(420),
          maxHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${scaled(16)} ${scaled(18)}`,
            borderBottom: `1px solid ${t.lineSoft}`,
          }}
        >
          <div>
            <Display size={18}>REDE SOCIAL</Display>
            <div style={{ marginTop: scaled(2), fontSize: scaled(11), color: t.muted }}>
              {game.career?.config.name} · {posts[0]?.season ?? 'temporada'}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: 'none',
              border: 'none',
              fontSize: scaled(20),
              color: t.muted,
              cursor: 'pointer',
              padding: scaled(4),
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: scaled(12) }}>
          {posts.length === 0 ? (
            <div
              style={{
                padding: `${scaled(32)} ${scaled(16)}`,
                textAlign: 'center',
                color: t.faintText,
                fontSize: scaled(13),
                lineHeight: 1.5,
              }}
            >
              Nada bombando ainda. 💤
              <br />
              Volte depois da próxima rodada.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: scaled(10) }}>
              {posts.map((post) => (
                <Post key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Post({ post }: { post: SocialPost }) {
  return (
    <article
      style={{
        border: `1px solid ${t.lineSoft}`,
        borderRadius: 8,
        padding: scaled(12),
        background: 'oklch(18% 0.015 55)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: scaled(8) }}>
        <div
          aria-hidden
          style={{
            width: scaled(30),
            height: scaled(30),
            borderRadius: '50%',
            background: t.faint,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: scaled(14),
            flexShrink: 0,
          }}
        >
          {AVATAR[post.kind]}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: scaled(4) }}>
            <span
              style={{
                fontSize: scaled(12),
                fontWeight: 700,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {post.name}
            </span>
            {post.verified && (
              <span style={{ color: t.accent, fontSize: scaled(11) }} title="Verificado">
                ✔
              </span>
            )}
          </div>
          <div style={{ fontSize: scaled(10), color: t.faintText }}>{post.handle}</div>
        </div>

        <SectionLabel
          style={{
            fontSize: scaled(8),
            color: REACH_COLOR[post.reach],
            flexShrink: 0,
          }}
        >
          {post.tag}
        </SectionLabel>
      </div>

      <div
        style={{
          marginTop: scaled(8),
          fontSize: scaled(12),
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
        }}
      >
        {post.text}
      </div>

      <div
        style={{
          marginTop: scaled(10),
          display: 'flex',
          gap: scaled(16),
          fontSize: scaled(10),
          color: t.faintText,
        }}
      >
        <span>💬 {formatCount(post.comments)}</span>
        <span>🔁 {formatCount(post.reposts)}</span>
        <span>❤️ {formatCount(post.likes)}</span>
      </div>
    </article>
  )
}
