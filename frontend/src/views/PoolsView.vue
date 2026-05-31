<template>
  <div class="pools-container">
    <div class="header-actions">
      <h1>Pule pytań</h1>
      <button @click="router.push('/groups')" class="back-btn">← Powrót</button>
    </div>
    <p class="info-text">
      Stwórz pulę, dodaj pytania ręcznie lub importuj z pliku — quiz losuje podzestaw
      w unikalnej kolejności dla każdego studenta.
    </p>

    <!-- Utwórz nową pulę -->
    <div class="create-pool">
      <h3>Nowa pula</h3>
      <div class="form-row">
        <input v-model="newPool.name" placeholder="Nazwa puli" />
        <input v-model="newPool.description" placeholder="Opis (opcjonalny)" />
        <button @click="createPool" class="btn-green">Utwórz pulę</button>
      </div>
      <p v-if="createError" class="error-msg">{{ createError }}</p>
    </div>

    <div v-if="pools.length === 0 && !loading" class="empty-state">
      Nie masz jeszcze żadnych pul pytań.
    </div>

    <!-- Lista pul -->
    <div v-for="p in pools" :key="p.id" class="pool-card">
      <div class="pool-header" @click="togglePool(p.id)">
        <div class="pool-title-row">
          <h3>{{ p.name }}</h3>
          <span class="pool-meta">{{ p.question_count }} pytań · {{ p.used_in_quizzes_count }} quizów</span>
        </div>
        <p v-if="p.description" class="pool-desc">{{ p.description }}</p>
        <div class="pool-header-actions" @click.stop>
          <button class="btn-expand" @click="togglePool(p.id)">{{ expandedPool === p.id ? '▲' : '▼' }}</button>
          <button @click="deletePool(p.id)" class="btn-red-sm" :disabled="p.used_in_quizzes_count > 0"
                  :title="p.used_in_quizzes_count > 0 ? 'Pula jest używana przez quiz' : 'Usuń pulę'">
            Usuń
          </button>
        </div>
      </div>

      <!-- Rozwinięte szczegóły puli -->
      <div v-if="expandedPool === p.id && poolDetail" class="pool-body">

        <!-- Zakładki -->
        <div class="tabs">
          <button :class="['tab', { active: activeTab === 'list' }]" @click="activeTab = 'list'">
            Pytania ({{ poolDetail.questions.length }})
          </button>
          <button :class="['tab', { active: activeTab === 'add' }]" @click="activeTab = 'add'">
            + Nowe pytanie
          </button>
          <button :class="['tab', { active: activeTab === 'import' }]" @click="activeTab = 'import'">
            ↑ Import z pliku
          </button>
          <button :class="['tab', { active: activeTab === 'bank' }]" @click="activeTab = 'bank'">
            Bank pytań
          </button>
        </div>

        <!-- TAB: Lista pytań -->
        <div v-if="activeTab === 'list'" class="tab-content">
          <p v-if="poolDetail.questions.length === 0" class="empty-tab">
            Pula jest pusta. Dodaj pytania przez zakładki powyżej.
          </p>
          <div v-for="q in poolDetail.questions" :key="q.id" class="q-row">
            <span class="q-badge" :class="q.question_type">
              {{ q.question_type === 'single' ? 'Jednokrotny' : 'Wielokrotny' }}
            </span>
            <span class="q-text">{{ q.content }}</span>
            <span class="q-stat">{{ q.answer_count }} odp.</span>
            <button @click="removeFromPool(p.id, q.id)" class="btn-red-sm">Usuń</button>
          </div>
        </div>

        <!-- TAB: Nowe pytanie -->
        <div v-if="activeTab === 'add'" class="tab-content">
          <div class="form-group">
            <label>Typ pytania:</label>
            <select v-model="newQ.question_type">
              <option value="single">Jednokrotny wybór</option>
              <option value="multiple">Wielokrotny wybór</option>
            </select>
          </div>
          <div class="form-group">
            <label>Treść pytania:</label>
            <textarea v-model="newQ.content" rows="3" placeholder="Wpisz treść pytania..."></textarea>
          </div>
          <div class="answers-section">
            <label>Odpowiedzi: <span class="hint">(zaznacz gwiazdką poprawne)</span></label>
            <div v-for="(ans, i) in newQ.answers" :key="i" class="ans-row">
              <label class="correct-check" :title="'Poprawna odpowiedź'">
                <input type="checkbox" v-model="ans.is_correct" />
                ★
              </label>
              <input v-model="ans.content" placeholder="Treść odpowiedzi" class="ans-input" />
              <button @click="newQ.answers.splice(i,1)" class="btn-red-sm" :disabled="newQ.answers.length <= 2">✕</button>
            </div>
            <button @click="newQ.answers.push({ content: '', is_correct: false })" class="btn-dashed">
              + Dodaj odpowiedź
            </button>
          </div>
          <p v-if="addQError" class="error-msg">{{ addQError }}</p>
          <button @click="addNewQuestion(p.id)" class="btn-blue">Dodaj pytanie do puli</button>
        </div>

        <!-- TAB: Import z pliku -->
        <div v-if="activeTab === 'import'" class="tab-content">
          <div class="format-box">
            <strong>Format pliku .txt:</strong>
            <pre>PYTANIE: single
Który typ JOIN zwraca tylko pasujące wiersze?
* INNER JOIN
- LEFT JOIN
- FULL OUTER JOIN

PYTANIE: multiple
Które właściwości należą do ACID?
* Atomicity
* Consistency
* Isolation
* Durability
- Scalability</pre>
            <p class="format-hint">
              <code>PYTANIE: single</code> lub <code>PYTANIE: multiple</code> — zaczyna nowe pytanie<br>
              Następna linia = treść pytania<br>
              <code>*</code> przed odpowiedzią = poprawna &nbsp;|&nbsp; <code>-</code> = błędna<br>
              Puste linie między pytaniami są ignorowane
            </p>
          </div>
          <div class="import-actions">
            <label class="file-label">
              <input type="file" accept=".txt" @change="handleFileSelect" ref="fileInput" />
              Wybierz plik .txt
            </label>
            <span v-if="importFile" class="file-name">{{ importFile.name }}</span>
          </div>
          <div v-if="parsedQuestions.length > 0" class="parsed-preview">
            <strong>Podgląd ({{ parsedQuestions.length }} pytań):</strong>
            <div v-for="(q, i) in parsedQuestions" :key="i" class="parsed-q">
              <span class="q-badge" :class="q.question_type">
                {{ q.question_type === 'single' ? 'J' : 'W' }}
              </span>
              {{ q.content }}
              <span class="ans-count">({{ q.answers.length }} odp., {{ q.answers.filter(a=>a.is_correct).length }} popr.)</span>
            </div>
          </div>
          <p v-if="parseError" class="error-msg">{{ parseError }}</p>
          <p v-if="importResult" :class="importResult.startsWith('Błąd') ? 'error-msg' : 'success-msg'">
            {{ importResult }}
          </p>
          <button @click="importQuestions(p.id)" class="btn-blue" :disabled="parsedQuestions.length === 0">
            Importuj {{ parsedQuestions.length > 0 ? parsedQuestions.length + ' pytań' : '' }}
          </button>
        </div>

        <!-- TAB: Bank pytań (istniejące) -->
        <div v-if="activeTab === 'bank'" class="tab-content">
          <p class="hint-text">Dodaj pytanie już istniejące w Twoim banku pytań.</p>
          <div class="form-row">
            <select v-model="selectedBankQ">
              <option value="">-- wybierz pytanie --</option>
              <option v-for="q in availableFromBank" :key="q.id" :value="q.id">
                [{{ q.question_type === 'single' ? 'J' : 'W' }}] {{ q.content.substring(0,90) }}{{ q.content.length > 90 ? '…' : '' }}
              </option>
            </select>
            <button @click="addFromBank(p.id)" class="btn-blue">Dodaj</button>
          </div>
          <p v-if="bankError" class="error-msg">{{ bankError }}</p>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api/index.js'

const router = useRouter()

const pools = ref([])
const loading = ref(true)
const expandedPool = ref(null)
const poolDetail = ref(null)
const activeTab = ref('list')
const allBankQuestions = ref([])

// Tworzenie puli
const newPool = ref({ name: '', description: '' })
const createError = ref('')

// Nowe pytanie
const newQ = ref(emptyQuestion())
const addQError = ref('')

// Import z pliku
const importFile = ref(null)
const parsedQuestions = ref([])
const parseError = ref('')
const importResult = ref('')
const fileInput = ref(null)

// Bank pytań
const selectedBankQ = ref('')
const bankError = ref('')

function emptyQuestion() {
  return {
    question_type: 'single',
    content: '',
    answers: [
      { content: '', is_correct: false },
      { content: '', is_correct: false }
    ]
  }
}

const availableFromBank = computed(() => {
  if (!poolDetail.value) return []
  const usedIds = new Set(poolDetail.value.questions.map(q => q.id))
  return allBankQuestions.value.filter(q => !usedIds.has(q.id))
})

onMounted(async () => {
  await Promise.all([loadPools(), loadBank()])
  loading.value = false
})

async function loadPools() {
  try {
    const { data } = await api.get('/pools')
    pools.value = data
  } catch { /* ignore */ }
}

async function loadBank() {
  try {
    const { data } = await api.get('/questions')
    allBankQuestions.value = data
  } catch { /* ignore */ }
}

async function createPool() {
  createError.value = ''
  if (!newPool.value.name.trim()) return (createError.value = 'Podaj nazwę puli')
  try {
    const { data } = await api.post('/pools', newPool.value)
    pools.value.unshift({ ...data, question_count: 0, used_in_quizzes_count: 0 })
    newPool.value = { name: '', description: '' }
  } catch (err) {
    createError.value = err.response?.data?.error || 'Błąd tworzenia puli'
  }
}

async function togglePool(poolId) {
  if (expandedPool.value === poolId) {
    expandedPool.value = null
    poolDetail.value = null
    return
  }
  expandedPool.value = poolId
  poolDetail.value = null
  activeTab.value = 'list'
  newQ.value = emptyQuestion()
  addQError.value = ''
  importFile.value = null
  parsedQuestions.value = []
  importResult.value = ''
  parseError.value = ''
  selectedBankQ.value = ''
  bankError.value = ''
  await refreshPoolDetail(poolId)
}

async function refreshPoolDetail(poolId) {
  try {
    const { data } = await api.get(`/pools/${poolId}`)
    poolDetail.value = data
    await loadPools()
  } catch {
    poolDetail.value = { questions: [] }
  }
}

// --- Nowe pytanie ---
async function addNewQuestion(poolId) {
  addQError.value = ''
  if (!newQ.value.content.trim()) return (addQError.value = 'Wpisz treść pytania')
  if (newQ.value.answers.length < 2) return (addQError.value = 'Minimum 2 odpowiedzi')
  if (!newQ.value.answers.some(a => a.is_correct)) return (addQError.value = 'Zaznacz co najmniej 1 poprawną odpowiedź')
  if (newQ.value.answers.some(a => !a.content.trim())) return (addQError.value = 'Wszystkie odpowiedzi muszą mieć treść')

  try {
    // Utwórz pytanie w banku
    const { data: q } = await api.post('/questions', {
      content: newQ.value.content,
      question_type: newQ.value.question_type,
      answers: newQ.value.answers
    })
    // Dodaj do puli
    await api.post(`/pools/${poolId}/questions`, { question_id: q.id })
    newQ.value = emptyQuestion()
    activeTab.value = 'list'
    await refreshPoolDetail(poolId)
  } catch (err) {
    addQError.value = err.response?.data?.error || 'Błąd dodawania pytania'
  }
}

// --- Import z pliku ---
function handleFileSelect(event) {
  const file = event.target.files[0]
  if (!file) return
  importFile.value = file
  parsedQuestions.value = []
  parseError.value = ''
  importResult.value = ''

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      parsedQuestions.value = parseQuestionsFile(e.target.result)
      if (parsedQuestions.value.length === 0) {
        parseError.value = 'Nie znaleziono pytań. Sprawdź format pliku.'
      }
    } catch (err) {
      parseError.value = 'Błąd parsowania pliku: ' + err.message
    }
  }
  reader.readAsText(file, 'UTF-8')
}

function parseQuestionsFile(text) {
  const questions = []
  // Dziel na bloki po słowie kluczowym PYTANIE:
  const blocks = text.split(/^PYTANIE:/im).filter(b => b.trim())

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l)
    if (lines.length < 3) continue

    const typeLine = lines[0].toLowerCase()
    const type = typeLine.includes('multiple') ? 'multiple' : 'single'
    const content = lines[1]
    const answers = []

    for (let i = 2; i < lines.length; i++) {
      const line = lines[i]
      if (line.startsWith('*')) {
        answers.push({ content: line.substring(1).trim(), is_correct: true })
      } else if (line.startsWith('-')) {
        answers.push({ content: line.substring(1).trim(), is_correct: false })
      }
    }

    if (content && answers.length >= 2 && answers.some(a => a.is_correct)) {
      questions.push({ content, question_type: type, answers })
    }
  }

  return questions
}

async function importQuestions(poolId) {
  importResult.value = ''
  if (parsedQuestions.value.length === 0) return
  try {
    const { data } = await api.post(`/pools/${poolId}/import`, {
      questions: parsedQuestions.value
    })
    importResult.value = `Zaimportowano ${data.imported} pytań!`
    if (data.errors?.length) {
      importResult.value += ` (${data.errors.length} błędów: ${data.errors.join(', ')})`
    }
    parsedQuestions.value = []
    importFile.value = null
    if (fileInput.value) fileInput.value.value = ''
    activeTab.value = 'list'
    await refreshPoolDetail(poolId)
  } catch (err) {
    importResult.value = 'Błąd: ' + (err.response?.data?.error || 'import nieudany')
  }
}

// --- Bank pytań ---
async function addFromBank(poolId) {
  bankError.value = ''
  if (!selectedBankQ.value) return (bankError.value = 'Wybierz pytanie')
  try {
    await api.post(`/pools/${poolId}/questions`, { question_id: selectedBankQ.value })
    selectedBankQ.value = ''
    await refreshPoolDetail(poolId)
  } catch (err) {
    bankError.value = err.response?.data?.error || 'Błąd dodawania'
  }
}

async function removeFromPool(poolId, questionId) {
  try {
    await api.delete(`/pools/${poolId}/questions/${questionId}`)
    await refreshPoolDetail(poolId)
  } catch { /* ignore */ }
}

async function deletePool(poolId) {
  if (!confirm('Usunąć tę pulę?')) return
  try {
    await api.delete(`/pools/${poolId}`)
    pools.value = pools.value.filter(p => p.id !== poolId)
    if (expandedPool.value === poolId) expandedPool.value = null
  } catch (err) {
    alert(err.response?.data?.error || 'Błąd usuwania')
  }
}
</script>

<style scoped>
.pools-container { max-width: 960px; margin: 20px auto; padding: 20px; }
.header-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.back-btn { padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; }
.info-text { color: #666; font-size: 14px; margin-bottom: 24px; }

/* Tworzenie puli */
.create-pool { background: #f8f9fa; border-radius: 8px; padding: 16px; margin-bottom: 28px; border: 1px solid #dee2e6; }
.create-pool h3 { margin: 0 0 10px; font-size: 16px; }
.form-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.form-row input, .form-row select { flex: 1; min-width: 140px; padding: 8px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; box-sizing: border-box; }

/* Karty pul */
.pool-card { border: 1px solid #dee2e6; border-radius: 8px; margin-bottom: 16px; overflow: hidden; }
.pool-header { padding: 16px; background: white; cursor: pointer; user-select: none; }
.pool-header:hover { background: #f8f9fa; }
.pool-title-row { display: flex; justify-content: space-between; align-items: center; }
.pool-title-row h3 { margin: 0; font-size: 16px; }
.pool-meta { font-size: 13px; color: #888; }
.pool-desc { margin: 4px 0 0; font-size: 13px; color: #555; }
.pool-header-actions { display: flex; gap: 8px; margin-top: 8px; }
.btn-expand { padding: 4px 10px; background: #e9ecef; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; }

/* Zakładki */
.pool-body { border-top: 1px solid #dee2e6; background: #fafafa; }
.tabs { display: flex; border-bottom: 2px solid #dee2e6; background: white; }
.tab { flex: 1; padding: 10px; border: none; background: none; cursor: pointer; font-size: 13px; font-weight: 500; color: #666; border-bottom: 2px solid transparent; margin-bottom: -2px; }
.tab.active { color: #007bff; border-bottom-color: #007bff; background: #f0f7ff; }
.tab-content { padding: 16px; min-height: 80px; }

/* Pytania w liście */
.q-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: white; border: 1px solid #e9ecef; border-radius: 4px; margin-bottom: 6px; }
.q-badge { font-size: 11px; padding: 2px 7px; border-radius: 10px; white-space: nowrap; flex-shrink: 0; }
.q-badge.single { background: #dbeeff; color: #0056b3; }
.q-badge.multiple { background: #fce8ff; color: #6f00b3; }
.q-text { flex: 1; font-size: 14px; }
.q-stat { font-size: 12px; color: #999; white-space: nowrap; }

/* Formularz nowego pytania */
.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-weight: 600; font-size: 13px; margin-bottom: 4px; }
.form-group select, .form-group textarea { width: 100%; padding: 8px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; box-sizing: border-box; }
.form-group textarea { resize: vertical; }
.answers-section label { font-weight: 600; font-size: 13px; display: block; margin-bottom: 6px; }
.hint { font-weight: normal; color: #888; }
.ans-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.correct-check { display: flex; align-items: center; gap: 4px; font-size: 16px; color: #ccc; cursor: pointer; flex-shrink: 0; }
.correct-check input:checked ~ { color: #ffa500; }
.correct-check input { width: auto; margin: 0; }
.ans-input { flex: 1; padding: 7px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; }

/* Format importu */
.format-box { background: #f4f4f4; border: 1px solid #ddd; border-radius: 6px; padding: 14px; margin-bottom: 14px; font-size: 13px; }
.format-box strong { display: block; margin-bottom: 8px; }
.format-box pre { background: white; border: 1px solid #ddd; border-radius: 4px; padding: 10px; font-size: 12px; overflow-x: auto; margin: 8px 0; line-height: 1.5; }
.format-hint { margin: 6px 0 0; line-height: 1.8; color: #555; }
.format-hint code { background: #e8e8e8; padding: 1px 5px; border-radius: 3px; font-size: 12px; }
.import-actions { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.file-label { display: inline-block; padding: 8px 16px; background: #6c757d; color: white; border-radius: 4px; cursor: pointer; font-size: 13px; }
.file-label input[type="file"] { display: none; }
.file-name { font-size: 13px; color: #555; }
.parsed-preview { margin-bottom: 12px; background: white; border: 1px solid #dee2e6; border-radius: 4px; padding: 10px; max-height: 200px; overflow-y: auto; }
.parsed-preview strong { display: block; margin-bottom: 8px; font-size: 13px; }
.parsed-q { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 4px 0; border-bottom: 1px solid #f0f0f0; }
.ans-count { color: #888; font-size: 12px; }
.hint-text { font-size: 13px; color: #666; margin-bottom: 10px; }

/* Przyciski */
.btn-green { padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; white-space: nowrap; }
.btn-blue { padding: 9px 18px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; margin-top: 4px; }
.btn-blue:disabled { background: #aaa; cursor: not-allowed; }
.btn-red-sm { padding: 5px 10px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; flex-shrink: 0; }
.btn-red-sm:disabled { background: #ccc; cursor: not-allowed; }
.btn-dashed { padding: 6px 12px; border: 1px dashed #007bff; background: white; color: #007bff; border-radius: 4px; cursor: pointer; font-size: 13px; margin-top: 4px; }

/* Komunikaty */
.error-msg { color: #dc3545; font-size: 13px; margin: 6px 0 0; }
.success-msg { color: #28a745; font-size: 13px; margin: 6px 0 0; }
.empty-state { text-align: center; color: #aaa; padding: 50px; font-size: 15px; }
.empty-tab { color: #aaa; text-align: center; padding: 20px; font-size: 14px; }
</style>
