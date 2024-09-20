import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
} from "firebase/auth";
import { getDatabase, ref, push, onValue, remove } from "firebase/database";
import './App.css'; // Import the CSS file

const firebaseConfig = {
  apiKey: "AIzaSyAypJYJddDpEH7d2Gh9wCdJxTerHXZG7X0",
  authDomain: "split-expense-bdf98.firebaseapp.com",
  projectId: "split-expense-bdf98",
  storageBucket: "split-expense-bdf98.appspot.com",
  messagingSenderId: "91584327045",
  appId: "1:91584327045:web:2745316f950d6552dd28ec",
  measurementId: "G-YQBLE9C9M7",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

const ExpenseSplittingApp = () => {
  const [user, setUser] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [splitWith, setSplitWith] = useState("");
  const [label, setLabel] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        // Listen for expenses
        const expensesRef = ref(database, "expenses");
        onValue(expensesRef, (snapshot) => {
          const data = snapshot.val();
          const loadedExpenses = [];
          for (const key in data) {
            loadedExpenses.push({
              id: key,
              ...data[key],
            });
          }
          setExpenses(loadedExpenses);
        });
      } else {
        signInAnonymously(auth);
      }
    });

    return () => unsubscribe();
  }, []);

  const addExpense = () => {
    if (amount && paidBy && splitWith) {
      const newExpense = {
        amount: parseFloat(amount),
        paidBy: paidBy.toLowerCase(), // Convert paidBy to lowercase
        splitWith: splitWith
          .split(",")
          .map((name) => name.trim().toLowerCase()), // Convert splitWith names to lowercase
        createdBy: user.uid,
        createdAt: Date.now(),
        label: label,
      };
      push(ref(database, "expenses"), newExpense);
      setAmount("");
      setPaidBy("");
      setSplitWith("");
      setLabel("");
    }
  };

  const deleteExpense = (id) => {
    remove(ref(database, `expenses/${id}`));
  };

  const calculateBalances = () => {
    const balances = {};
    expenses.forEach((expense) => {
      const { amount, paidBy, splitWith } = expense;
      const splitAmount = amount / (splitWith.length + 1);

      if (!balances[paidBy]) balances[paidBy] = 0;
      balances[paidBy] += amount - splitAmount;

      splitWith.forEach((person) => {
        if (!balances[person]) balances[person] = 0;
        balances[person] -= splitAmount;
      });
    });
    return balances;
  };

  const triangulateDebts = (balances) => {
    const debtors = Object.entries(balances).filter(
      ([_, balance]) => balance < 0,
    );
    const creditors = Object.entries(balances).filter(
      ([_, balance]) => balance > 0,
    );
    const transactions = [];

    while (debtors.length > 0 && creditors.length > 0) {
      const [debtor, debtAmount] = debtors.shift();
      const [creditor, creditAmount] = creditors.shift();

      const transactionAmount = Math.min(-debtAmount, creditAmount);
      transactions.push({
        from: debtor,
        to: creditor,
        amount: transactionAmount.toFixed(2),
      });

      if (-debtAmount < creditAmount) {
        creditors.unshift([creditor, creditAmount + debtAmount]);
      } else if (-debtAmount > creditAmount) {
        debtors.unshift([debtor, debtAmount + creditAmount]);
      }
    }

    return transactions;
  };

  const balances = calculateBalances();
  const transactions = triangulateDebts(balances);

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="expense-app">
      <h1>Shared Expense Splitting App</h1>
      <div>
        <label htmlFor="amount">Amount: </label>
        <input
          id="amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter amount"
          className="input-field"
        />
      </div>
      <div>
        <label htmlFor="paidBy">Paid By: </label>
        <input
          id="paidBy"
          value={paidBy}
          onChange={(e) => setPaidBy(e.target.value)}
          placeholder="Enter name"
          className="input-field"
        />
      </div>
      <div>
        <label htmlFor="splitWith">Split With (comma-separated): </label>
        <input
          id="splitWith"
          value={splitWith}
          onChange={(e) => setSplitWith(e.target.value)}
          placeholder="Enter names"
          className="input-field"
        />
      </div>
      <div>
        <label htmlFor="label">Label: </label>
        <input
          id="label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Enter label (e.g., Groceries)"
          className="input-field"
        />
      </div>
      <button onClick={addExpense} className="button">Add Expense</button>

      <h2>Expenses</h2>
      <ul className="expense-list">
        {expenses.map((expense) => (
          <li key={expense.id} className="expense-item">
            <span>{expense.paidBy} paid ${expense.amount} (Split with: {expense.splitWith.join(", ")}) - {expense.label}</span>
            <button
              onClick={() => deleteExpense(expense.id)}
              className="button delete"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>

      <h2>Balances</h2>
      <ul className="expense-list">
        {Object.entries(balances).map(([person, balance]) => (
          <li key={person} className="expense-item">
            {person}: ${balance.toFixed(2)} {balance > 0 ? "(to receive)" : "(to pay)"}
          </li>
        ))}
      </ul>

      <h2>Optimized Transactions</h2>
      <ul className="expense-list">
        {transactions.map((transaction, index) => (
          <li key={index} className="expense-item">
            {transaction.from} pays ${transaction.amount} to {transaction.to}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ExpenseSplittingApp;