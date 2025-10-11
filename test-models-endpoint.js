const jwt = require('jsonwebtoken');

// Crear un token JWT válido para el usuario premium
const token = jwt.sign(
    {
        id: 'c621aaf8-5139-4773-ae1e-79f49b595300',
        sub: 'c621aaf8-5139-4773-ae1e-79f49b595300',
        email: 'rolmo92@gmail.com'
    },
    'tu_secreto_muy_seguro2024', // Usar la misma clave que en el backend
    { expiresIn: '1h' }
);

console.log('Token generado:', token);
console.log('\nProbando endpoint /api/chat/models...');

// Usar fetch para probar el endpoint
fetch('http://localhost:3000/api/chat/models', {
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
})
    .then(response => response.json())
    .then(data => {
        console.log('\nRespuesta del endpoint:');
        console.log(JSON.stringify(data, null, 2));

        if (data.models) {
            console.log('\nModelos disponibles:');
            data.models.forEach((model, index) => {
                console.log(`${index + 1}. ${model.name} (${model.provider}) - Premium: ${model.isPremium}`);
            });
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
