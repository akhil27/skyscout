export interface Outing {
  title: string
  placeName: string
  lat?: number
  lng?: number
  dateOptions?: string[]
  chosenDate?: string
  notes?: string
  status?: string
  guide?: string
  guideModel?: string
  guideAt?: string
  guideDate?: string
  weatherCache?: Array<{
    dt: number
    temp: number
    feels_like?: number
    humidity?: number
    description?: string
    icon?: string
  }>
  weatherAt?: string
  goScore?: number
  photoUrl?: string
}

export interface Vote {
  userId?: string
  outingId: string
  option: string
  choice: 'go' | 'maybe' | 'no'
  note?: string
}

export interface OutingComment {
  outingId: string
  body: string
}
