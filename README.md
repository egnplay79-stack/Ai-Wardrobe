# AI Wardrobe

Mobile-first приложение-гардероб: **Photo → AI обработка → Wardrobe → AI Outfit**.

```
ai-wardrobe/
├── client/                 React 18 + TypeScript + Vite (PWA-ready, mobile-first)
│   └── src/
│       ├── api/            HTTP-клиент: POST /api/items/process, POST /api/outfits/generate
│       ├── components/     Button, IconButton, ItemCard, OutfitCard, OutfitBoard, BottomNavigation,
│       │                   LoadingState, EmptyState, ImagePreview, AIProcessingView, ItemFields, Toast, Icon
│       ├── screens/        Wardrobe, AddItem, Processing, ItemResult, ItemDetail, EditItem,
│       │                   Outfits, OutfitDetail, ItemOutfits ("Create outfit from this item")
│       ├── hooks/          useWardrobe, useNavigator, useItemProcessing, useOutfitGeneration, useAIStatus
│       ├── services/
│       │   ├── AIService.ts                выбор провайдера + автоматический fallback на on-device
│       │   ├── ImageProcessingService.ts   фото → вещь на белом (сервер или on-device)
│       │   ├── ClothingDetectionService.ts поиск вещи на фото + атрибуты
│       │   ├── WardrobeService.ts          CRUD гардероба поверх StorageAdapter
│       │   ├── OutfitGenerationService.ts  аутфиты по гардеробу и вокруг одной вещи
│       │   ├── ai/         AIProvider (интерфейс), MockProvider, ClaudeArtifactProvider, HttpProvider,
│       │   │               prompts, normalize, outfitRules (общие с сервером)
│       │   └── storage/    StorageAdapter, LocalStorageAdapter (IndexedDB), ArtifactStorageAdapter
│       ├── types/          WardrobeItem, Outfit, Detection, ItemAttributes…
│       └── utils/          cutout (сегментация/выпрямление/белый фон), image, color, id
└── server/                 Hono (Node) — ключи вендоров живут только здесь
    └── src/
        ├── index.ts        эндпоинты
        ├── config.ts       реестр провайдеров (env)
        └── providers/      anthropic (vision + аутфиты), rules (офлайн),
                            imageEdit: none | removebg | photoroom | replicate (генеративный flat-lay)
```

## Запуск

```bash
# только клиент — работает сразу, без ключей и сервера (on-device режим)
cd client && npm install && npm run dev

# с сервером
cd server && npm install && cp .env.example .env   # вписать ключи
npm run dev                                        # :8787
cd ../client && VITE_API_URL=http://localhost:8787 npm run dev
```

`VITE_AI_PROVIDER` = `auto` (по умолчанию) | `mock` | `claude` | `http`.
`auto`: внутри Claude → Claude, иначе если сервер отвечает → сервер, иначе on-device.

## Публикация на GitHub (ссылка вида https://ИМЯ.github.io/ai-wardrobe/)

Всё уже настроено: `.github/workflows/deploy-pages.yml` собирает `client/` и выкладывает на GitHub Pages при каждом push в `main`. Сборка с `base: "./"`, поэтому работает из подпапки.

1. github.com → **New repository** → имя `ai-wardrobe`, **Public** → Create (без README).
2. Загрузить проект (из папки `ai-wardrobe`, где лежат `client/`, `server/`, `.github/`):
   ```bash
   cd ~/Downloads/ai-wardrobe
   git init && git add . && git commit -m "AI Wardrobe"
   git branch -M main
   git remote add origin https://github.com/ИМЯ/ai-wardrobe.git
   git push -u origin main
   ```
   (или одной командой, если стоит GitHub CLI: `gh repo create ai-wardrobe --public --source=. --push`)
3. В репозитории: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. **Actions** → дождаться зелёной галочки у «Deploy to GitHub Pages» (~1–2 мин). Если первый запуск упал до шага 3 — **Re-run all jobs**.
5. Ссылка: `https://ИМЯ.github.io/ai-wardrobe/`. На iPhone: Safari → Поделиться → На экран «Домой».

Каждый следующий `git push` обновляет сайт автоматически.

**AI на GitHub Pages.** Вне Claude приложение работает в режиме *On-device*: фон удаляется на телефоне, категории угадываются по форме, аутфиты собирает встроенный стилист по правилам, разбор LOOKS — вручную. Для полноценного AI разверните `server/` (Railway / Render / Fly.io) с `ANTHROPIC_API_KEY`, в его `CORS_ORIGIN` укажите `https://ИМЯ.github.io`, а в GitHub: **Settings → Secrets and variables → Actions → Variables → `VITE_API_URL`** = адрес сервера, затем Actions → Run workflow. Ключ API никогда не кладите в клиент или в репозиторий.

**Данные.** На github.io гардероб хранится в браузере телефона (IndexedDB). Добавьте приложение на экран «Домой» — так Safari не очистит данные при долгом неиспользовании. Синхронизация между устройствами — через свой `StorageAdapter` (например, Supabase).

## Как устроен AI

| Шаг | On-device (mock) | Claude / сервер |
|---|---|---|
| Найти вещь, атрибуты | форма + цвет пикселей, категория по пропорциям | vision-модель: имя, категория, тип, цвет, материал, стиль, сезон, пол, рамка, наклон |
| Убрать фон и лишние предметы | region growing от краёв → цветовые модели фона/ткани (k-means, GrabCut-подобный пересчёт) → удаление теней и просветов → мягкая маска 3–4 px + очистка края от цвета пола | то же + контур вещи от vision-модели как подсказка, либо remove.bg / Photoroom на сервере |
| Выпрямить | наклон по моментам маски | угол от модели |
| Белый фон, 4:5 | да | да |
| Расправить складки | нет | только `IMAGE_PROVIDER=replicate` (генеративный) |
| Аутфиты | детерминированный rule-based стилист | LLM с проверкой: только существующие id, top+bottom или dress, без дублей |

Любой сбой AI (нет доступа, лимит, сеть) → вызов повторяется on-device, флоу не ломается, пользователь видит короткий toast.

### Заменить провайдера
* Клиент: реализовать `AIProvider` (`services/ai/AIProvider.ts`) и добавить в `AIService.select()`.
* Сервер: класс с `LLMProvider` или `ImageEditProvider` + `case` в `server/src/config.ts`.
* Хранилище: реализовать `StorageAdapter` (например Supabase) и вернуть его в `WardrobeService.init()`.

## Ограничения (честно)
* **Складки.** Без генеративной модели «расправить» нельзя: on-device и remove.bg/Photoroom вырезают, выравнивают и ставят на белое, складки остаются. Replicate (FLUX Kontext) разглаживает, но может менять детали — промпт это запрещает, но результат стоит показывать пользователю с кнопкой «Try again» (она есть).
* **Перспектива.** Исправляется наклон (поворот), не трапеция. Для настоящего keystone нужны 4 угла от модели + гомография — точка расширения в `utils/cutout.ts`.
* **Сложный фон.** On-device сегментация рассчитана на однотонную поверхность. Белая вещь на белой простыне или пёстрый ковёр → лучше серверный remove.bg/Photoroom.
* Параметры Photoroom и Replicate сверить с актуальной документацией вендора перед продом.

## Ключевые сценарии
* **Вещь без фона.** Каждая вещь хранится как вырезанный PNG с прозрачным фоном (on-device сегментация, или remove.bg/Photoroom, или генеративный сервер + вырезание с белого). Если фон отделить не удалось, экран YOUR ITEM честно об этом говорит и предлагает Try again.
* **Аутфит на белом, как носят.** `OutfitBoard` раскладывает сверху вниз: очки/шапка → куртка и верх → ремень → низ (сумка рядом) → обувь. Плотно, без наложений. Зона аксессуара определяется по его типу.
* **Try again.** Каждый повтор заново удаляет фон другим методом (Standard → Cleaner edges → Keep more fabric → Fine detail → Follow the outline → Strong removal, затем варианты с другими порогами), на первом повторе вещь заново распознаётся AI. Повтор, неотличимый от прежнего или плохой по качеству (весь кадр, рваный контур), пропускается. Все версии сохраняются, между ними можно листать ‹ ›.
* **Реальные пропорции.** `utils/sizes.ts` — типичный размер по типу: одежда по длине (футболка 70 см, пуховик 72, джинсы 105), обувь и аксессуары по длинной стороне (кроссовок 30, очки 14), обувь ×1.2, пара сбоку ×1.5. Тип ищется и в соседней категории (пуховик, сохранённый как Top). `OutfitBoard` измеряет видимую границу вещи на картинке (без пустых полей и пятнышек), раскладывает в сантиметрах и масштабирует весь образ одним коэффициентом в пикселях.
* **AI-размеры.** Vision-модель оценивает реальные размеры каждой вещи в см (`realCm`) по её фото: при распознавании, а для старых вещей — один раз пачкой, вместе, чтобы оценки были согласованы (`SizingService`, `POST /api/items/sizes`). Раскладка берёт площадь по AI (ширина × высота) и сохраняет пропорции фото; таблица типичных размеров — запасной вариант и защита от явно неверных оценок.
* **Размер вещи.** На экране вещи и при редактировании: щипок, ctrl+колесо или «− 100% +» (50–150%). Хранится в `scale` и учитывается в аутфитах.
* **Перед съёмкой.** Экран с правилами (однотонный контрастный фон, одна вещь, сверху, дневной свет) и примером «да/нет». После выбора фото фон проверяется; если он пёстрый — предложение переснять.
* **Выбор вещей для аутфита.** OUTFITS → Create outfit → экран выбора с фильтром по категориям. «Generate» — AI собирает комплекты только из выбранного. «Style this set» — выбранные вещи становятся одним аутфитом, AI даёт название и объяснение.
* **Сохранённые аутфиты.** У аутфита есть флаг `saved`. AI-генерация даёт «AI suggestions» (`saved: false`), закладка на карточке или «Save outfit» сохраняет. Новая генерация заменяет только несохранённые подсказки; сохранённые и «Style this set» живут, пока их не удалят. Аутфиты из старых версий считаются сохранёнными. Edit outfit меняет состав и имя на месте (тот же id).
* **Аутфиты как вещи.** Вкладка OUTFITS — такая же сетка карточек, как гардероб; страница аутфита повторяет страницу вещи: крупная картинка, имя, параметры (Pieces / Type / Style / Created), состав, «Why it works», действия.
* **LOOKS (третья вкладка).** Свои фото в образах (селфи, стрит, вдохновение) без удаления фона. AI (`describeLook`, `POST /api/looks/describe`) даёт имя, описание, список видимых вещей и сопоставляет их с гардеробом — только уверенные совпадения. Всё редактируется (имя, заметка, теги, отметки вещей). Из найденных вещей — «Make outfit from these pieces» → сохранённый аутфит.
* **Режимы генерации.** На экране выбора вещей: *All outfits* — все хорошие сочетания (до 12), *Best match* — один самый гармоничный аутфит (AI может не взять неподходящие вещи), *Exactly these* — выбранные вещи как один аутфит. Выбор запоминается.
* **ABOUT (четвёртая вкладка).** Что делает продукт: логотип, 5 шагов с линейными иллюстрациями (`components/AboutArt.tsx`), советы по съёмке, текущий режим AI и место хранения данных, установка на iPhone. Подпись автора и версия — константы `MAKER` и `VERSION` в `screens/AboutScreen.tsx`.
* **Фильтр в гардеробе.** All / Outerwear / Tops / Bottoms / Dresses / Shoes / Accessories со счётчиками.

## Логотип и установка
`client/public/icons/` — логотип (белый фон, «AI / WARDROBE» шрифтом Inter 600 с разрядкой 0.14em, как заголовки в приложении): `logo.svg`, `icon-1024.png` (для App Store), `icon-512/192.png` (PWA), `apple-touch-icon.png` (180, экран «Домой» на iPhone), `wordmark.png`. `manifest.webmanifest` + мета-теги Apple в `index.html` делают сайт устанавливаемым («На экран „Домой“» → полноэкранное приложение). При запуске показывается тот же логотип, пока грузится гардероб.

## Модель данных
`WardrobeItem { id, userId, imageUrl, name, category, type, color, colorHex, material, style, season, gender, createdAt }`
`Look { id, userId, imageUrl, title, note, description, pieces[], itemIds[], tags[], createdAt }`
`Outfit { id, userId, name, itemIds, description, reasons[], source: "wardrobe" | "item" | "manual", anchorItemId?, saved?, createdAt }`
При удалении вещи удаляются аутфиты, в которые она входила.
