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
import { cardShort, rankLabel } from "../engine/cards"
import { describeCombo } from "../engine/combos"
import type { GameState, MatchSave } from "../engine/game"
import { SEAT_NAMES, TEAM_NAMES } from "./names"
import type { Skills } from "./useGame"

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
        <DialogTitle>本局出牌记录</DialogTitle>
        <DialogDescription>
          {game.log.length === 0 ? "本局还没有人出牌。" : "从第一手到现在，按出牌顺序排列。本局结束后还能看到四家的起手牌。"}
        </DialogDescription>
        <ol data-slot="review-log">
          {game.log.map((record, index) => (
            // oxlint-disable-next-line react/no-array-index-key -- the log only grows, so position is identity
            <li key={index} data-pass={record.combo ? undefined : ""}>
              {SEAT_NAMES[record.player]}：
              {record.combo
                ? `${describeCombo(record.combo, game.level)}（${record.combo.cards.map(cardShort).join(" ")}）`
                : "不出"}
            </li>
          ))}
        </ol>
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
}: {
  skills: Skills
  onChange: (skills: Skills) => void
  onStartOver: () => void
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
        <DialogClose data-variant="play">好了</DialogClose>
      </DialogContent>
    </Dialog>
  )
}

export { LogDialog, ResumeDialog, RulesDialog, SettingsDialog }
