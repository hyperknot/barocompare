/* @refresh reload */
import { render } from 'solid-js/web'

import { AppUI } from './App.tsx'

// 1. tailwind, 2. scss
import './styles/tailwind/_tailwind.css'
import './styles/stylesheet.scss'

const root = document.getElementById('root')

render(() => <AppUI />, root!)
