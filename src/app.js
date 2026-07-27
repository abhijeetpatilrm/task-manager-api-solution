const express = require('express');
const taskRoutes = require('./routes/tasks');

const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Task Management API is live and operational.',
    documentation: {
      endpoints: {
        'GET /tasks': 'Fetch all tasks (supports status, priority, page, limit filters)',
        'POST /tasks': 'Create a new task',
        'GET /tasks/:id': 'Fetch a task by ID',
        'PATCH /tasks/:id': 'Update task fields',
        'DELETE /tasks/:id': 'Delete a task',
        'PATCH /tasks/:id/complete': 'Mark task as completed',
        'PATCH /tasks/:id/assign': 'Assign a task to a user',
      },
    },
  });
});

app.use('/tasks', taskRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Task API running on port ${PORT}`);
  });
}

module.exports = app;
