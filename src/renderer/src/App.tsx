import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import Browser from "./components/Browser"
import { ChatProvider } from './ai/ChatContext';
import { CommandProvider } from './components/parts/CommandContext';

const App = (): JSX.Element => {

  return (
    <ChatProvider>
    <CommandProvider>
    <Router>
    <Routes>
      <Route path="/" element={<Browser />} />
    </Routes>
  </Router>
  </CommandProvider>
  </ChatProvider>
  )
}

export default App