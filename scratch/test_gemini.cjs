const axios = require('axios');
const apiKey = 'AIzaSyDtxSJee1iz-yJJMW48ZioEBPru3lN7HME';
const model = 'gemini-1.5-pro';

axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
  contents: [{ parts: [{ text: "Hello" }] }]
})
.then(res => console.log("SUCCESS", res.data))
.catch(err => console.error("ERROR", err.response ? err.response.status : err.message));
