const axios = require('axios');
const apiKey = 'AIzaSyDtxSJee1iz-yJJMW48ZioEBPru3lN7HME';

async function testModel(model) {
  try {
    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      contents: [{ parts: [{ text: "Hello" }] }]
    });
    console.log("SUCCESS", model);
  } catch (err) {
    console.error("ERROR", model, err.response ? err.response.status : err.message);
  }
}

testModel('gemini-1.5-pro-latest');
testModel('gemini-2.5-pro');
testModel('gemini-2.5-flash');
testModel('gemini-1.5-flash-latest');
