'use client'

import { useState, useEffect } from 'react'
import { Box, Stack, Typography, Button, Modal, TextField, InputAdornment, Paper } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import SendIcon from '@mui/icons-material/Send'
import { firestore } from '../firebase'
import {client} from '../openai'
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  deleteDoc,
  getDoc,
} from 'firebase/firestore'

const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: '#1E1E1E',
  border: '1px solid #333',
  boxShadow: '0 0 20px rgba(0, 255, 255, 0.2)',
  borderRadius: '10px',
  p: 4,
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  color: '#fff',
}
const contrastColor = "#1138FD";

export default function Home() {
  const [inventory, setInventory] = useState([])
  const [open, setOpen] = useState(false)
  const [itemName, setItemName] = useState('')
  const [itemDescription, setItemDescription] = useState('')
  const [itemQuantity, setItemQuantity] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')

  // Chatbot messages
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  
  const startNewChat = () => {
    setMessages([]);
  };

  //For Filtering the inventory
  const filteredInventory = inventory.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description.toLowerCase().includes(searchTerm.toLowerCase())
  )
  
  //Gets the inventory from the firestore database and updates the state
  const updateInventory = async () => {
    const snapshot = query(collection(firestore, 'inventory'))
    const docs = await getDocs(snapshot)
    const inventoryList = []
    docs.forEach((doc) => {
      inventoryList.push({ name: doc.id, ...doc.data() })
    })
    setInventory(inventoryList)
  }

  //Adds an item to the inventory
  const addItem = async (item, description, initialQuantity) => {
    const docRef = doc(collection(firestore, 'inventory'), item)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      const { quantity, description: existingDescription } = docSnap.data()
      await setDoc(docRef, { 
        quantity: quantity + initialQuantity, 
        description: existingDescription || description 
      })
    } else {
      await setDoc(docRef, { quantity: initialQuantity, description })
    }
    await updateInventory()
  }
  //Updates the quantity of an item in the inventory
  const updateItemQuantity = async (item, newQuantity) => {
    const docRef = doc(collection(firestore, 'inventory'), item)
    const validQuantity = Math.max(0, parseInt(newQuantity) || 0)
    if (validQuantity === 0) {
      // If the quantity is 0, remove the item
      await deleteDoc(docRef)
    } else {
      // Otherwise, update the quantity
      const docSnap = await getDoc(docRef)
      const { quantity, description: existingDescription } = docSnap.data()
      await setDoc(docRef, { quantity: validQuantity, description: existingDescription }, { merge: true })
    }
  await updateInventory()
  }

  //Removes an item from the inventory
  const removeItem = async (item) => {
    const docRef = doc(collection(firestore, 'inventory'), item)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
        await deleteDoc(docRef)
    }
    await updateInventory()
  }
  //Opens the modal/pop-up
  const handleOpen = () => setOpen(true)
  const handleClose = () => setOpen(false)

  // Fetch the inventory from the database when the component mounts
  useEffect(() => {
    updateInventory()
  }, [])

  // Function to get recipe recommendation
  const getRecipeRecommendation = async () => {
    setIsLoading(true);
    const messageInput = "Suggest a recipe using ingredients from my inventory: " + inventory.map(item => item.name).join(", ");
    try {
      const response = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: "system", content: "You are a helpful cooking assistant." },
          { role: "user", content: messageInput },
        ],
        max_tokens: 150,
        temperature: 0.8,
      });
      console.log(response.choices[0]);
      const recipe = response.choices[0].message.content.trim();
      const formattedRecipe = recipe.replace(/\n/g, '\n\n');
      setMessages(prevMessages => [...prevMessages, 
        { text: messageInput, sender: 'user' },
        { text: formattedRecipe, sender: 'bot' }]);
    } catch (error) {
      console.error("Error getting Recs: ", error);
      setMessages(prevMessages => [...prevMessages, { text: "Sorry, I couldn't find a recipe. Please try again later.", sender: 'bot' }]);
    }
    setIsLoading(false);
  }

  // Function to chat with AI
  const chatWithAI = async (userMessage) => {
    setIsLoading(true);
    const updatedMessages = [
      ...messages,
      { role: "user", content: userMessage },
    ];
    try {
      const response = await client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: updatedMessages, messages: updatedMessages.map(message => ({
          role: message.sender === 'bot' ? 'assistant' : 'user',
          content: message.text || message.content
        })),
        max_tokens: 300,
        temperature: 0.7,
      });
      console.log(response.choices[0]);
      const aiResponse = response.choices[0].message.content.trim();
      const formattedResponse = aiResponse.replace(/\n/g, '\n\n');
      setMessages(prevMessages => [
        ...prevMessages,
        { text: formattedResponse, sender: 'bot' }
      ]);
    } catch (error) {
      console.error("Error chatting with AI:", error);
      setMessages(prevMessages => [
        ...prevMessages,
        { text: "Sorry, I couldn't process your message at this time.", sender: 'bot' }
      ]);
    }
    setIsLoading(false);
  }

  // Function to handle sending a message
  const handleSendMessage = async () => {
    if (inputMessage.trim() !== '') {
      setMessages(prevMessages => [...prevMessages, { text: inputMessage, sender: 'user' }]);
      setInputMessage('');
      await chatWithAI(inputMessage);
    }
  };
  
    return (
      // Main container
      <Box
      sx={{
        width: "100vw",
        height: "100vh",
        display: 'flex',
        bgcolor: '#121212',
      }}
      >
        {/* Left Side of the page */}
        <Box
        sx={{
          width: '60%',
          height: '100%',
          p: 5,
          overflowY: 'auto',
        }}
        >
          {/* Form for adding Item*/}
        <Modal
          open={open}
          onClose={handleClose}
          aria-labelledby="modal-modal-title"
          aria-describedby="modal-modal-description"
        >
          <Box sx={style}>
            <Typography id="modal-modal-title" variant="h6" component="h2">
              Add New Item
            </Typography>
            
            <Stack width="100%" direction={'column'} spacing={3}>
              <TextField
                label="Item Name"
                variant="outlined"
                fullWidth
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                sx={{
                  input: { color: '#fff' },
                  '& label': { color: '#CECACA' },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#333' },
                    '&:hover fieldset': { borderColor: contrastColor },
                    '&.Mui-focused fieldset': { borderColor: contrastColor },
                  },
                }}
              />
              <TextField
                label="Description"
                multiline
                rows={4}
                variant="outlined"
                fullWidth
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                sx={{
                  textarea: { color: '#fff' },
                  '& label': { color: '#CECACA' },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#333' },
                    '&:hover fieldset': { borderColor: contrastColor },
                    '&.Mui-focused fieldset': { borderColor: contrastColor },
                  },
                }}
              />
              <TextField
                label="Quantity"
                type="number"
                variant="outlined"
                fullWidth
                value={itemQuantity}
                onChange={(e) => setItemQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                sx={{
                  input: { color: '#fff' },
                  '& label': { color: '#CECACA' },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#333' },
                    '&:hover fieldset': { borderColor: contrastColor },
                    '&.Mui-focused fieldset': { borderColor: contrastColor },
                  },
                }}
              />
              <Button
                variant="contained"
                onClick={() => {
                  addItem(itemName, itemDescription, itemQuantity)
                  setItemName('')
                  setItemDescription('')
                  setItemQuantity(1)
                  handleClose()
                }}
                sx={{
                  bgcolor: contrastColor,
                  '&:hover': {
                    boxShadow: '0 0 10px #1138FD',
                  },
                }}
              >
                Add
              </Button>
            </Stack>
          </Box>
        </Modal>
        
        {/* Button for adding new item */}
        <Button 
          variant="contained" 
          onClick={handleOpen}
          sx={{
            bgcolor: contrastColor,
            '&:hover': {
              boxShadow: '0 0 10px "#1138FD"',
            },
            mb: 4,
          }}
        >
          Add New Item
        </Button>
        {/* Inventory Items */}
        <Box sx={{ 
          border: '1px solid #333', 
          borderRadius: '10px', 
          overflow: 'hidden',
          boxShadow: '0 0 20px rgba(17, 56, 253)',
        }}>
          {/* Title */}
          <Box
            sx={{
              bgcolor: '#1E1E1E',
              p: 2,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Typography variant={'h4'} color={'#fff'} textAlign={'center'}>
              Inventory Items
            </Typography>
          </Box>
          {/* Search Bar */}
          <Box sx={{ p: 2 }}>
            <TextField
              fullWidth
              variant="outlined"
              label="Search items"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <SearchIcon sx={{ color: '#aaa' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                mb: 2,
                input: { color: '#fff' },
                '& label': { color: '#aaa' },
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: '#333' },
                  '&:hover fieldset': { borderColor: contrastColor },
                  '&.Mui-focused fieldset': { borderColor: contrastColor },
                },
              }}
            />
          </Box>
          {/* Inventory List */}
          <Stack sx={{ height: '300px', overflow: 'auto', p: 2 }} spacing={2}>
            {filteredInventory.map(({name, quantity, description}) => (
              <Box
                key={name}
                sx={{
                  bgcolor: '#1E1E1E',
                  borderRadius: '5px',
                  p: 2,
                  transition: 'all 0.3s',
                  '&:hover': {
                    boxShadow: '0 0 10px rgba(17, 56, 253, 0.8)',
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <Box display={'flex'} justifyContent={'space-between'} alignItems={'center'}>
                  <Typography variant={'h6'} color={'#fff'}>
                    {name.charAt(0).toUpperCase() + name.slice(1)}
                  </Typography>
                  <Box display={'flex'} alignItems={'center'}>
                    <TextField
                      type="number"
                      value={quantity}
                      onChange={(e) => {
                        const newQuantity = Math.max(0, parseInt(e.target.value) || 0);
                        updateItemQuantity(name, newQuantity);
                      }}
                      inputProps={{ min: 0, style: { textAlign: 'center', color: '#fff' } }}
                      sx={{ 
                        width: '80px', 
                        mr: 2,
                        '& .MuiOutlinedInput-root': {
                          '& fieldset': { borderColor: '#333' },
                          '&:hover fieldset': { borderColor: contrastColor },
                          '&.Mui-focused fieldset': { borderColor: contrastColor },
                        },
                      }}
                    />
                    <Button 
                      variant="outlined" 
                      onClick={() => removeItem(name)}
                      sx={{
                        color: '#ff4d4f',
                        borderColor: '#ff4d4f',
                        '&:hover': {
                          bgcolor: 'rgba(255, 77, 79, 0.1)',
                          boxShadow: '0 0 10px rgba(255, 77, 79, 0.3)',
                        },
                      }}
                    >
                      Remove
                    </Button>
                  </Box>
                </Box>
                <Typography variant={'body2'} color={'#aaa'} mt={1}>
                  {description || 'No description available'}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>
      {/* Right Side of the page */}
      <Box
        sx={{
          width: '40%',
          height: '100%',
          p: 3,
          borderLeft: '1px solid #333',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Typography variant="h4" sx={{ mb: 2, color: '#FFFFFF' }}>
          Inventory Assistant
          {/* New Chat */}
          <Button
            variant="contained"
            onClick={startNewChat}
            sx={{
              width: 'fit-content',
              bgcolor: contrastColor,
              ml: 5,
              '&:hover': {
                boxShadow: '0 0 10px #00bcd4',
              },
            }}
          >
            New Chat
          </Button>
        </Typography>
        
        {/* Chatbot */}
        <Button
          variant="contained"
          onClick={getRecipeRecommendation}
          sx={{
            bgcolor: contrastColor,
            mb: 2,
            '&:hover': {
              boxShadow: '0 0 10px #00bcd4',
            },
          }}
        >
          Get Recipe Recommendation
        </Button>
        <Paper
          elevation={3}
          sx={{
            flex: 1,
            bgcolor: '#1E1E1E',
            borderRadius: '10px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Chat messages */}
          <Box
            sx={{
              flex: 1,
              p: 2,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {messages.map((message, index) => (
              <Box
                key={index}
                sx={{
                  maxWidth: '80%',
                  p: 2,
                  mb: 2,
                  bgcolor: message.sender === 'user' ? contrastColor : '#333',
                  borderRadius: '10px',
                  alignSelf: message.sender === 'user' ? 'flex-end' : 'flex-start',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                }}
              >
                <Typography
                  sx={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: message.sender === 'user' ? '#fff' : '#f0f0f0',
                    fontSize: '1rem',
                    lineHeight: 1.5,
                  }}
                >
                  {message.text}
                </Typography>
              </Box>
            ))}
            {isLoading && (
              <Box sx={{ alignSelf: 'flex-start', color: '#aaa' }}>
                <Typography>Thinking...</Typography>
              </Box>
            )}
          </Box>
          {/* chatbot input */}
          <Box sx={{ p: 2, bgcolor: '#252525' }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Ask me anything..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Button onClick={handleSendMessage}>
                      <SendIcon sx={{ color: contrastColor }} />
                    </Button>
                  </InputAdornment>
                ),
              }}
              sx={{
                input: { color: '#fff' },
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: '#333' },
                  '&:hover fieldset': { borderColor: contrastColor },
                  '&.Mui-focused fieldset': { borderColor: contrastColor },
                },
              }}
            />
          </Box>
        </Paper>
      </Box>
    </Box>
    )
  }