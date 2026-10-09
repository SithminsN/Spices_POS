import { dateKeyOf } from '../../lib/format'
import './DateTimeFields.css'

interface DateTimeFieldsProps {
  /** Unique per row, for label/input ids. */
  idPrefix: string
  /** yyyy-mm-dd */
  date: string
  /** HH:MM */
  time: string
  onDateChange: (value: string) => void
  onTimeChange: (value: string) => void
}

/** Side-by-side Date and Time inputs for editing when a record happened. */
export function DateTimeFields({ idPrefix, date, time, onDateChange, onTimeChange }: DateTimeFieldsProps) {
  const today = dateKeyOf(Date.now())
  return (
    <div className="date-time-fields">
      <div className="field">
        <label htmlFor={`${idPrefix}-date`}>Date</label>
        <input
          id={`${idPrefix}-date`}
          className="num"
          type="date"
          value={date}
          max={today}
          onChange={(e) => onDateChange(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-time`}>Time</label>
        <input
          id={`${idPrefix}-time`}
          className="num"
          type="time"
          value={time}
          onChange={(e) => onTimeChange(e.target.value)}
        />
      </div>
    </div>
  )
}
