import {observe} from 'selector-observer'
import {throttle} from 'throttle-debounce'

const draggables = window.DRAGGABLES || []

// prevent re-running initialization in development mode (HMR)
if (window.DRAGGABLES_LOADED) {
  while (draggables.length) {
    const draggable = draggables.shift()
    draggable.remove()
  }
} else {
  window.DRAGGABLES = draggables
  window.DRAGGABLES_LOADED = true

  const attr = 'data-draggable'

  window.addEventListener('resize', throttle(30, false, () => {
    for (const draggable of draggables) {
      draggable.resize()
    }
  }))

  observe(`svg[${attr}], svg [${attr}]`, {
    add(el) {
      const index = draggables.findIndex(d => d.source === el)
      if (index > -1) {
        // console.warn('[draggable] already registered:', el, '@', index)
        return
      } else {
        // console.warn('[draggable] add:', el)
      }
      el.removeAttribute(attr)
      draggables.push(new Draggable(el))
    }
  })
}

class Draggable {
  constructor(el) {
    this.source = el
    this.target = cloneAndIsolate(el)
    this.position = {x: 0, y: 0}

    const {source, target} = this
    target.style.setProperty('cursor', 'pointer')
    target.style.setProperty('position', 'absolute')
    document.body.appendChild(target)

    this.resize()

    this.mouseMove = this.mouseMove.bind(this)
    this.mouseDown = downEvent => {
      // prevent text selection
      downEvent.preventDefault()
      this.dragging = true
      document.addEventListener('mousemove', this.mouseMove)
      window.addEventListener('mouseup', () => {
        this.dragging = false
        document.removeEventListener('mousemove', this.mouseMove)
      })
    }
    target.addEventListener('mousedown', this.mouseDown)
  }

  mouseMove(e) {
    const {position, source, target} = this
    position.x += e.movementX
    position.y += e.movementY
    const topLeft = globalToLocal(position, source)

    // add the relative offset of the source to its <svg> element
    // ...why? ¯\_(ツ)_/¯ I have no idea!
    const rect = source.getBoundingClientRect()
    const ownerRect = getOwner(source).getBoundingClientRect()
    topLeft.x += rect.x - ownerRect.x
    topLeft.y += rect.y - ownerRect.y

    source.setAttribute('transform', 'translate(' + [topLeft.x, topLeft.y] + ')')
    target.style.setProperty('left', px(position.x))
    target.style.setProperty('top', px(position.y))
  }

  resize() {
    const {position, source, target} = this
    source.removeAttribute('transform')
    const rect = source.getBoundingClientRect()
    position.x = rect.x
    position.y = rect.y
    target.style.setProperty('left', px(rect.left))
    target.style.setProperty('top', px(rect.top))
    target.style.setProperty('width', px(rect.width))
    target.style.setProperty('height', px(rect.height))
  }

  remove() {
    this.target.remove()
    this.target.removeEventListener('mousedown', this.mouseDown)
  }
}

function globalToLocal(global, context) {
  const owner = getOwner(context)
  const ctm = owner.getScreenCTM()
  const local = owner.createSVGPoint()
  local.x = global.x
  local.y = global.y
  return local.matrixTransform(ctm.inverse())
}

function cloneAndIsolate(el) {
  const rect = el.getBoundingClientRect()
  const owner = getOwner(el)
  const outerRect = owner.getBoundingClientRect()

  const topLeft = globalToLocal({x: rect.left, y: rect.top}, el)
  const bottomRight = globalToLocal({x: rect.right, y: rect.bottom}, el)

  const viewBox = [
    topLeft.x,
    topLeft.y,
    bottomRight.x - topLeft.x,
    bottomRight.y - topLeft.y
  ]

  // cloning without (true) does a shallow clone: node + attributes,
  // no children
  const outer = owner.cloneNode()
  outer.removeAttribute('class')
  outer.setAttribute('width', rect.width)
  outer.setAttribute('viewBox', viewBox.join(' '))
  outer.appendChild(el.cloneNode(true))
  return outer
}

function getOwner(el) {
  return el.matches('svg') ? el : el.ownerSVGElement
}

function px(n) {
  return n + 'px'
}
