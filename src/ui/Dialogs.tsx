import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@ui-sdk/react/dialog"
import { Field, FieldDescription, FieldLabel } from "@ui-sdk/react/field"
import { SegmentedControl, SegmentedControlItem } from "@ui-sdk/react/segmented-control"
import type { Skill } from "../engine/bot"
import { Button } from "@ui-sdk/react/button"
import { useState } from "react"
import { rankLabel } from "../engine/cards"
import type { GameState, MatchSave } from "../engine/game"
import { APP_VERSION, BUILD_DATE, REPO_URL } from "./buildInfo"
import { TEAM_NAMES } from "./names"
import { PlayLog } from "./PlayLog"
import type { Skills } from "./useGame"
import type { View } from "./view"
import { ViewSwitch } from "./ViewSwitch"

const RULES: [string, string][] = [
  ["牌型", "单张、对子、三张、三带二、五张顺子、三连对（如 334455）、钢板（如 333444）。"],
  ["王", "红色 JOKER 是大王，黑色 JOKER 是小王。大王最大，小王第二。"],
  ["级牌", "本局打几，几就是级牌，比 A 大、比王小。顺子里级牌按原来的点数算。"],
  ["逢人配", "红桃级牌可以当任意牌用（不能当王）。"],
  ["炸弹", "四张及以上同点数。四张 < 五张 < 同花顺 < 六张及以上 < 四大天王，同级比点数。"],
  ["升级", "头游的对家是二游升 3 级，三游升 2 级，末游升 1 级。"],
  ["过 A", "打 A 时要拿到头游且对家不是末游才算赢。三次打 A 不过，退回打 2。"],
  ["进贡", "末游把最大的牌（红桃级牌除外）交给头游，头游还一张 10 或更小的牌。双下时两家都进贡。输家有两张大王可以抗贡。"],
  ["接风", "一家出完后没人压得住他最后一手牌，由他的对家接着出。"],
]

function RulesDialog() {
  return (
    <Dialog>
      <DialogTrigger data-variant="text">规则</DialogTrigger>
      <DialogBackdrop />
      <DialogContent>
        <DialogTitle>掼蛋规则速查</DialogTitle>
        <DialogDescription>两副牌，四人两队，对家是队友。先把牌出完的一队升级，先打过 A 的一队获胜。</DialogDescription>
        <dl data-slot="rules">
          {RULES.map(([term, text]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
        <DialogClose data-variant="play">知道了</DialogClose>
      </DialogContent>
    </Dialog>
  )
}

function LogDialog({ game }: { game: GameState }) {
  return (
    <Dialog>
      <DialogTrigger data-variant="text">复盘</DialogTrigger>
      <DialogBackdrop />
      <DialogContent>
        <DialogTitle>本局复盘</DialogTitle>
        <DialogDescription>进贡和每一手出牌，按先后顺序排列。本局结束后还能看到四家的起手牌。</DialogDescription>
        <div data-slot="review">
          <PlayLog game={game} />
        </div>
        <DialogClose data-variant="play">继续打牌</DialogClose>
      </DialogContent>
    </Dialog>
  )
}

const LEVELS: [Skill, string][] = [
  ["novice", "新手"],
  ["basic", "普通"],
  ["advanced", "进阶"],
]

const LEVEL_NOTES: Record<Skill, string> = {
  novice: "偶尔出错，该压的时候不压，不记牌。",
  basic: "基本功扎实：会留炸弹、不拆好牌，但不记牌、不配合。",
  advanced: "会记牌、顶牌、给对家送牌，知道拦快出完的对手。",
}

function SkillField({ label, value, onChange }: { label: string; value: Skill; onChange: (skill: Skill) => void }) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <SegmentedControl value={value} onValueChange={(next) => next && onChange(next as Skill)}>
        {LEVELS.map(([skill, name]) => (
          <SegmentedControlItem key={skill} value={skill}>
            {name}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
      <FieldDescription>{LEVEL_NOTES[value]}</FieldDescription>
    </Field>
  )
}

function ResumeDialog({ save, onResume, onNew }: { save: MatchSave | null; onResume: () => void; onNew: () => void }) {
  return (
    <Dialog open={save !== null} dismissible={false}>
      <DialogBackdrop />
      <DialogContent>
        {save ? (
          <>
            <DialogTitle>继续上次的对局？</DialogTitle>
            <DialogDescription>
              上次打完了第 {save.handNumber} 局：{TEAM_NAMES[0]}打 {rankLabel(save.levels[0])}，{TEAM_NAMES[1]}打{" "}
              {rankLabel(save.levels[1])}。保存于 {new Date(save.savedAt).toLocaleString("zh-CN")}。
            </DialogDescription>
            <div data-slot="dialog-actions">
              <Button data-variant="play" onClick={onResume}>
                继续第 {save.handNumber + 1} 局
              </Button>
              <Button data-variant="outline" onClick={onNew}>
                新开一场
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function SettingsDialog({
  skills,
  onChange,
  onStartOver,
  view,
  onViewChange,
  onHome,
}: {
  skills: Skills
  onChange: (skills: Skills) => void
  onStartOver: () => void
  view: View
  onViewChange: (view: View) => void
  onHome?: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  return (
    <Dialog onOpenChange={(open) => !open && setConfirming(false)}>
      <DialogTrigger data-variant="text">设置</DialogTrigger>
      <DialogBackdrop />
      <DialogContent>
        <DialogTitle>电脑玩家水平</DialogTitle>
        <DialogDescription>改动立即生效。教练的提示和点评始终按“进阶”水平给出。</DialogDescription>
        <SkillField
          label="两位对手（上家、下家）"
          value={skills.opponents}
          onChange={(opponents) => onChange({ ...skills, opponents })}
        />
        <SkillField label="你的对家" value={skills.partner} onChange={(partner) => onChange({ ...skills, partner })} />
        <Field>
          <FieldLabel>牌桌</FieldLabel>
          <ViewSwitch view={view} onChange={onViewChange} />
          <FieldDescription>2D 是平面牌桌，3D 是立体牌桌。规则、提示和教练都一样，随时可以换。</FieldDescription>
        </Field>
        <Field>
          <FieldLabel>存档</FieldLabel>
          <FieldDescription>
            每打完一局，双方级别会自动保存在这个浏览器里，下次打开可以接着打。存档不会上传，换浏览器或清除浏览数据后就没有了。
          </FieldDescription>
          {confirming ? (
            <DialogClose data-variant="danger" action={onStartOver}>
              确认：清除存档，从打 2 重新开始
            </DialogClose>
          ) : (
            <Button data-variant="outline" onClick={() => setConfirming(true)}>
              重新开始整场比赛
            </Button>
          )}
        </Field>
        {onHome ? (
          <Field>
            <FieldLabel>换一个游戏</FieldLabel>
            <FieldDescription>首页可以选掼蛋或德州扑克。打完的局已经保存，回来可以接着打。</FieldDescription>
            <DialogClose data-variant="outline" action={onHome}>
              回到首页
            </DialogClose>
          </Field>
        ) : null}
        <section data-slot="about" aria-label="关于">
          <div>
            <h3>关于</h3>
            <p>
              掼蛋教练 <b>v{APP_VERSION}</b> · {BUILD_DATE} 更新
            </p>
          </div>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            GitHub 源代码
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16">
              <path d="M6 3H3v10h10v-3M9 2h5v5M14 2 7.5 8.5" />
            </svg>
          </a>
        </section>
        <DialogClose data-variant="play">好了</DialogClose>
      </DialogContent>
    </Dialog>
  )
}

export { LogDialog, ResumeDialog, RulesDialog, SettingsDialog }
