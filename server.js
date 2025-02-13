require('dotenv').config();
const express = require('express');
const mysql = require("mysql2/promise");
const cors = require('cors');
const sendResponse = require("./helpers/responseHelper");

const app = express();
const PORT = process.env.PORT || 4000;


app.use(cors());
app.use(express.json());


app.get('/', (req, res) => {
    res.json({ message: 'Welcome to my API1!' });
});

const pool = mysql.createPool({
    host: "apitest.malangculinary.com",
    user: "rahm3231_ts",
    password: "Rizki5566",
    database: "rahm3231_test_sprint",
    waitForConnections: true,
    queueLimit: 0,
    keepAliveInitialDelay: 10000,
    enableKeepAlive: true, 
});

module.exports = pool;

app.post("/task", async (req, res) => {
    const { title, deadline } = req.body;
    try {
        const [result] = await pool.query(
          "INSERT INTO tb_main_task (title, deadline) VALUES (?, ?)", [title, deadline || null]
        );
        
        sendResponse(res, 200, true, "Task added successfully", "Task added successfully");
    } catch (err) {
        console.error("Database error:", err);
        sendResponse(res, 500, true, "Server error", "Server error");
    }
});


app.post("/subtask", async (req, res) => {
    const { title, id_master } = req.body;
    try {
        const [result] = await pool.query(
          "INSERT INTO tb_sub_task (title, id_master) VALUES (?, ?)", [title, id_master]
        );
        sendResponse(res, 200, true, "SubTask added successfully", "SubTask added successfully");
    } catch (err) {
        console.error("Database error:", err);
        sendResponse(res, 500, true, "Server error", "Server error");
    }
});

app.get("/taskcompleted", async (req, res) => {
    try {
        const [results] = await pool.query("SELECT m.id AS id, m.title AS title, m.is_completed AS is_completed, m.deadline AS deadline, m.completed_date AS completed_date, s.id AS sub_id, s.title AS sub_title, s.is_completed AS sub_completed, s.id_master AS id_master FROM tb_main_task m LEFT JOIN tb_sub_task s ON m.id = s.id_master where m.is_completed = 1");
        const tasks = {};
        results.forEach(row => {
            if (!tasks[row.id]) {
                tasks[row.id] = {
                    id: row.id,
                    title: row.title,
                    is_completed: row.is_completed,
                    deadline: row.deadline,
                    completed_date: row.completed_date,
                    sub_tasks: []
                };
            }

            if (row.sub_id) {
                tasks[row.id].sub_tasks.push({
                    id: row.sub_id,
                    title: row.sub_title,
                    is_completed: row.sub_completed,
                    id_master: row.id_master
                });
            }
        });

        const resultData = Object.values(tasks);
        sendResponse(res, 200, true, "Success", resultData);
    } catch (err) {
        console.error("Database error:", err);
        sendResponse(res, 500, false, "Server error", []);
    }
});

app.get("/taskongoing", async (req, res) => {
    try {
        const [results] = await pool.query("SELECT m.id AS id, m.title AS title, m.is_completed AS is_completed, m.deadline AS deadline, m.completed_date AS completed_date, s.id AS sub_id, s.title AS sub_title, s.is_completed AS sub_completed, s.id_master AS id_master FROM tb_main_task m LEFT JOIN tb_sub_task s ON m.id = s.id_master where m.is_completed = 0");
        const tasks = {};
        results.forEach(row => {
            if (!tasks[row.id]) {
                tasks[row.id] = {
                    id: row.id,
                    title: row.title,
                    is_completed: row.is_completed,
                    deadline: row.deadline,
                    completed_date: row.completed_date,
                    sub_tasks: []
                };
            }

            if (row.sub_id) {
                tasks[row.id].sub_tasks.push({
                    id: row.sub_id,
                    title: row.sub_title,
                    is_completed: row.sub_completed,
                    id_master: row.id_master
                });
            }
        });
        const resultData = Object.values(tasks);
        sendResponse(res, 200, true, "Success", resultData);
    } catch (err) {
        console.error("Database error:", err);
        sendResponse(res, 500, false, "Server error", []);
    }
});


app.post("/updatetask/:id", async (req, res) => {
    const { title, deadline, completed_date, is_completed } = req.body;
    try {
        const { id } = req.params;
    
        const connection = await pool.getConnection();
        await connection.beginTransaction();
    
        try {

          const [updateMainTask] = await connection.query(
            `UPDATE tb_main_task SET title = ?, deadline = ?, completed_date = ?, is_completed = ? WHERE id = ?`,
            [title, deadline || null, completed_date || null, is_completed, id]
          );
    
          if (updateMainTask.affectedRows === 0) {
            throw new Error("Task not found");
          }
    
          await connection.query(
            `UPDATE tb_sub_task SET is_completed = ? WHERE id_master = ?`,
            [is_completed, id]
          );
    
          await connection.commit(); 
    
          sendResponse(res, 200, true, "Task updated successfully", "Task updated successfully");
        } catch (err) {
          await connection.rollback(); 
          throw err;
        } finally {
          connection.release(); 
        }
      } catch (err) {
        console.error(err);
        sendResponse(res, 500, false, "Server error", "Server error");
      }
});


app.post("/updatesubtask/:id",async (req, res) => {
    const { title, is_completed, id_master } = req.body;
    try {
        const { id } = req.params;

        const connection = await pool.getConnection();
        await connection.beginTransaction(); 
    
        try {
    
          await connection.query(
            `UPDATE tb_sub_task SET title = ?, is_completed = ? WHERE id = ?`,
            [title, is_completed, id]
          );
    
          const [totalSubtasks] = await connection.query(
            `SELECT COUNT(*) AS count FROM tb_sub_task WHERE id_master = ?`,
            [id_master]
        );
    
        const [completedSubtasks] = await connection.query(
            `SELECT COUNT(*) AS count FROM tb_sub_task WHERE id_master = ? AND is_completed = 1`,
            [id_master]
        );

        if (totalSubtasks[0].count === completedSubtasks[0].count) {
            await connection.query(
                `UPDATE tb_main_task SET is_completed = 1, completed_date = NOW() WHERE id = ?`,
            [id_master]
            );
        } else {
            await connection.query(
              `UPDATE tb_main_task SET is_completed = 0, completed_date = NULL WHERE id = ?`,
              [id_master]
            );
          }
    
          await connection.commit(); 
    
          sendResponse(res, 200, true, "Subtask updated successfully", "Subtask updated successfully");
        } catch (err) {
          await connection.rollback(); 
          throw err;
        } finally {
          connection.release(); 
        }
      } catch (err) {
        console.error(err);
        sendResponse(res, 500, false, "Server error", "Server error");
      }
});


app.post("/deletetask/:id", async (req, res) => {

    try {
        const { id } = req.params;
    
        const connection = await pool.getConnection();
        await connection.beginTransaction();
    
        try {
    
          await connection.query(
            `DELETE FROM tb_sub_task WHERE id_master = ?`,
            [id]
          );

          const [updateMainTask] = await connection.query(
            `DELETE FROM tb_main_task WHERE id = ?`,
            [id]
          );
    
          await connection.commit(); 
    
          sendResponse(res, 200, true, "Task deleted successfully", "Task deleted successfully");
        } catch (err) {
          await connection.rollback(); 
          throw err;
        } finally {
          connection.release(); 
        }
    } catch (err) {
        console.error(err);
        sendResponse(res, 500, false, "Server error", "Server error");
    }
});


app.post("/deletesubtask/:id", async (req, res) => {
    try {
        const { id } = req.params;
    
        const connection = await pool.getConnection();
        if (!connection) {
          return sendResponse(res, 500, false, "Failed to get database connection", "Failed to get database connection");
        }
    
        await connection.beginTransaction();
    
        try {
            const [subtask] = await connection.query(
                `SELECT id_master FROM tb_sub_task WHERE id = ?`,
            [id]
            );
    
            if (subtask.length === 0) {
                connection.release();
                return sendResponse(res, 404, false, "Subtask not found", "Subtask not found");
            }
    
            const id_master = subtask[0].id_master;
    
            await connection.query(`DELETE FROM tb_sub_task WHERE id = ?`, [id]);
    
            const [totalSubtasks] = await connection.query(
                `SELECT COUNT(*) AS count FROM tb_sub_task WHERE id_master = ?`,
                [id_master]
            );
        
            const [completedSubtasks] = await connection.query(
                `SELECT COUNT(*) AS count FROM tb_sub_task WHERE id_master = ? AND is_completed = 1`,
                [id_master]
            );
    
            if (totalSubtasks[0].count != 0 && totalSubtasks[0].count === completedSubtasks[0].count) {
                await connection.query(
                `UPDATE tb_main_task SET is_completed = 1, completed_date = NOW() WHERE id = ?`,
                [id_master]
                );
            } else {
                await connection.query(
                `UPDATE tb_main_task SET is_completed = 0, completed_date = NULL WHERE id = ?`,
                [id_master]
                );
            }
        
            await connection.commit();
            connection.release();
        
            sendResponse(res, 200, true, "Subtask deleted successfully", "Subtask deleted successfully");
        } catch (err) {
            await connection.rollback();
            connection.release();
            throw err;
        }
    } catch (err) {
        console.error(err);
        sendResponse(res, 500, false, "Server error", "Server error");
    }
});

//   // Tambah sub-task
//   app.post("/tasks/:id/subtasks", (req, res) => {
//     const { title } = req.body;
//     db.query("INSERT INTO subtasks (task_id, title, completed) VALUES (?, ?, false)", [req.params.id, title], (err, result) => {
//       if (err) throw err;
//       res.json({ message: "Sub-task added", subTaskId: result.insertId });
//     });
//   });

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
