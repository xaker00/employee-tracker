require("dotenv").config();
const inquirer = require("inquirer");
const cTable = require("console.table");
const mysql = require("mysql2/promise");

const mainMenu = async (conn) => {
  // console.log('conn from mainMenu', conn)
  while (true) {
    const { answer } = await inquirer.prompt([
      {
        type: "list",
        name: "answer",
        message: "Main Menu",
        choices: [
          "View all departments",
          "View all roles",
          "View all employees",
          "Add a department",
          "Add a role",
          "Add an employee",
          "Update an employee role",
          "Exit application",
        ],
      },
    ]);

    switch (answer) {
      case "View all departments":
        await viewDepartments(conn);
        break;
      case "View all roles":
        await viewRoles(conn);
        break;
      case "View all employees":
        await viewEmployees(conn);
        break;
      case "Add a department":
        await addDepartment(conn);
        break;
      case "Add a role":
        await addRole(conn);
        break;
      case "Add an employee":
        await addEmployee(conn);
        break;
      case "Update an employee role":
        await employeeUpdateRole(conn);
        break;
      case "Exit application":
        process.exit();
        break;
      default:
        console.log("Unknown option, try again");
    }
  }
};

async function viewDepartments(conn) {
  const query = `SELECT 
  name
  FROM department
  `;

  const [rows] = await conn.execute(query);

  q = `===============\n`;
  q += `# DEPARTMENTS #\n`;
  q += `===============`;
  console.log(q);
  console.table(rows);
}
const viewRoles = async (conn) => {
  const query = `SELECT 
  role.id, title, salary, department.name as department_name
  FROM role
  JOIN department ON role.department_id = department.id
  `;

  const [rows] = await conn.execute(query);

  q = `=========\n`;
  q += `# Roles #\n`;
  q += `=========`;
  console.log(q);
  console.table(rows);
};
const viewEmployees = async (conn) => {
  const query = `SELECT 
    emp.id,
    emp.first_name,
    emp.last_name,
    role.title,
    role.salary,
    department.name as department_name,
    (select concat(first_name, " ", last_name) from employee where employee.id = emp.manager_id ) as manager
  FROM employee emp
  JOIN role
    ON emp.role_id = role.id
  JOIN department
    ON role.department_id = department.id
  `;

  const [rows] = await conn.execute(query);

  q = `=============\n`;
  q += `# EMPLOYEES #\n`;
  q += `=============`;
  console.log(q);
  console.table(rows);
};
const addDepartment = async (conn) => {
  const query = `insert into department(name) values (?)`;
  const { name } = await inquirer.prompt([
    { type: "input", name: "name", message: "Department Name?" },
  ]);
  try {
    const result = await conn.execute(query, [name]);
    console.log(`Added department "${name}"`);
  } catch (err) {
    console.log("Could not add department", err);
  }
};
const addRole = async (conn) => {
  const queryInsert = `insert into role(title, salary, department_id) values (?,?,?)`;
  const queryDepartments = `select id, name from department`;
  let [departments] = await conn.execute(queryDepartments);

  const role = await inquirer.prompt([
    {
      type: "list",
      name: "department",
      message: "Choose department",
      choices: departments.map((q) => q.name),
    },
    { type: "input", name: "title" },
    { type: "number", name: "salary" },
  ]);
  try {
    const departmentId = departments.filter(
      (q) => q.name === role.department
    )[0].id;
    await conn.execute(queryInsert, [role.title, role.salary, departmentId]);
    console.log(
      `Added role "${role.title}" to department ${role.department} with salary $${role.salary}`
    );
  } catch (err) {
    console.log("Could not add role", err);
  }
};

const addEmployee = async (conn) => {
  const queryInsert = `insert into employee(first_name, last_name, role_id, manager_id) values (?,?,?,?)`;
  const queryDepartments = `select id, name from department`;
  const queryRoles = `select id, title from role where department_id = ?`;
  const queryManagers = `select emp.id, concat(first_name, ' ' , last_name, ' (', r.title, ')') as manager
  from employee emp 
  join role r on r.id = emp.role_id 
  join department d on d.id=r.department_id and r.department_id = ?`;
  const [departments] = await conn.execute(queryDepartments);

  const employee = await inquirer.prompt([
    {
      type: "list",
      name: "department",
      message: "Choose department",
      choices: departments.map((q) => q.name),
    },
    { type: "input", name: "first_name", message: "First Name?" },
    { type: "input", name: "last_name", message: "Last Name?" },
  ]);

  const departmentId = departments.filter(
    (q) => q.name === employee.department
  )[0].id;
  const [roles] = await conn.execute(queryRoles, [departmentId]);

  const { role } = await inquirer.prompt([
    { type: "list", name: "role", choices: roles.map((q) => q.title) },
  ]);

  const roleId = roles.filter((q) => q.title === role)[0].id;
  let managerId;

  const { hasManager } = await inquirer.prompt([
    {
      type: "confirm",
      name: "hasManager",
      message: "Choose a manager?",
      default: true,
    },
  ]);

  if (hasManager) {
    const [managers] = await conn.execute(queryManagers, [departmentId]);
    const { manager } = await inquirer.prompt([
      {
        type: "list",
        name: "manager",
        choices: managers.map((q) => q.manager),
      },
    ]);

    managerId = managers.filter((q) => q.manager === manager)[0].id;
  }

  try {
    await conn.execute(queryInsert, [
      employee.first_name,
      employee.last_name,
      roleId,
      managerId,
    ]);
    console.log(`Added employee ${employee.first_name} ${employee.last_name}`);
  } catch (err) {
    console.log("Could not add employee", err);
  }
};

const employeeUpdateRole = async (conn) => {
  const queryEmployees = `select id, concat(first_name, ' ', last_name) as employee from employee`;
  const queryRoles = `select 
    r.id,
    r.title
  from role r 
  where r.department_id = (select dep.id from department dep join role ro on ro.department_id = dep.id join employee e on e.role_id = ro.id and e.id = ?)
  
  `;
  const queryUpdateRole = `update employee set role_id = ? where id = ?`;

  const [employees] = await conn.execute(queryEmployees);

  const { employee } = await inquirer.prompt([
    {
      type: "list",
      name: "employee",
      choices: employees.map((q) => ({ value: q.id, name: q.employee })),
    },
  ]);

  const [roles] = await conn.execute(queryRoles, [employee]);

  const { role } = await inquirer.prompt([
    {
      type: "list",
      name: "role",
      choices: roles.map((q) => ({ value: q.id, name: q.title })),
    },
  ]);

  try {
    await conn.execute(queryUpdateRole, [role, employee]);
    console.log("Updated employee role");
  } catch (err) {
    console.log("Unable to update employee role", err);
  }
};

const init = async (conn) => {
  try {
    conn = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASS,
      database: "employees_db",
    });
    // console.log(conn);
    mainMenu(conn);
  } catch (err) {
    console.log(err);
  }
};

let conn;

init(conn);
