const express = require('express');
const path = require('path');
const app = express();

app.use(express.static(path.join(__dirname, 'src/client')));
app.use('/public', express.static(path.join(__dirname, 'src/client/public')));

app.listen(3050, () => {
  console.log('✅ Frontend running on http://localhost:3050');
});
