export default class UserInfo {
  constructor() {
    this.key = 'user_info'
    this.data = this.load()
    if (!this.data) {
      this.data = this.askUser()
      this.save()
    }
  }

  askUser() {
    let name = ''
    let age = ''
    while (!name) {
      name = prompt('¿Cuál es tu nombre?')
      if (name === null) name = ''
    }
    while (!age || isNaN(age) || age <= 0) {
      age = prompt('¿Cuál es tu edad?')
      if (age === null) age = ''
    }
    return { name, age: Number(age) }
  }

  save() {
    localStorage.setItem(this.key, JSON.stringify(this.data))
  }

  load() {
    try {
      const raw = localStorage.getItem(this.key)
      if (!raw) return null
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  getName() {
    return this.data?.name ?? ''
  }

  getAge() {
    return this.data?.age ?? ''
  }
}
