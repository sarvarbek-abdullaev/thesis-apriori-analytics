# Manager Analytics System – Apriori-Based Decision Support

## 1. Overview

This project is a full-stack analytical system designed to support managerial decision-making by extracting interpretable patterns from employee survey data using the Apriori algorithm.

The system enables managers to identify key factors influencing job satisfaction and take targeted actions based on data-driven insights.

Unlike black-box machine learning models, this system prioritizes **interpretability, transparency, and actionable insights**.

---

## 2. Architecture

### System Design

```text
Frontend (React) → REST API (Node.js/Express) → Data Source (Google Sheets CSV)
```

### Components

* **Frontend:** Interactive dashboard for managers
* **Backend:** Data processing, rule mining, API services
* **Data Layer:** Google Sheets (survey responses)

---

## 3. Core Features

* Association Rule Mining (Apriori Algorithm)
* Support, Confidence, and Lift metrics
* Factor-based filtering (Salary, Career, Leadership, etc.)
* Adjustable confidence threshold
* Trend analysis (monthly dissatisfaction)
* REST API integration
* Visual dashboard for managerial interpretation

---

## 4. Analytical Model

### Workflow

1. Collect employee survey data
2. Normalize responses into categorical values
3. Generate transactional dataset
4. Apply Apriori algorithm to extract frequent itemsets
5. Generate association rules
6. Evaluate rules using:

   * Support
   * Confidence
   * Lift
7. Present insights in an interpretable format

---

## 5. Rule Structure

```text
Condition(s) → Outcome
```

Example:

```text
SAL1_Low → JS2_Low
```

Interpretation:

Low perception of salary is associated with low job satisfaction.

---

## 6. Metrics

| Metric     | Description                              |
| ---------- | ---------------------------------------- |
| Support    | Frequency of occurrence in dataset       |
| Confidence | Probability of outcome given condition   |
| Lift       | Strength of association vs random chance |

Interpretation:

* Lift > 1 → meaningful relationship
* Lift = 1 → no relationship
* Lift < 1 → negative association

---

## 7. Technology Stack

### Backend

* Node.js
* Express.js
* Axios
* csv-parse

### Frontend

* React.js
* Axios
* Recharts

### Data Source

* Google Sheets (CSV integration)

---

## 8. API Endpoints

### GET `/insights`

Returns association rules for managerial insights.

Query parameters:

* `top`: number of rules
* `confidence`: minimum confidence threshold
* `factor`: optional filter

---

### GET `/stats`

Returns aggregated dissatisfaction indicators by factor.

---

### GET `/trends`

Returns time-based dissatisfaction trends.

---

### GET `/report`

Generates a summary for managerial review.

---

## 9. Setup & Installation

### Backend

```bash
cd backend
npm install
```

Create `.env`:

```env
SHEET_CSV_URL=https://docs.google.com/spreadsheets/d/YOUR_ID/export?format=csv
```

Run:

```bash
node server.js
```

---

### Frontend

```bash
cd frontend
npm install
npm start
```

---

## 10. Data Processing

Survey responses are mapped into:

| Input             | Output |
| ----------------- | ------ |
| Strongly Agree    | High   |
| Agree             | High   |
| Neutral           | Medium |
| Disagree          | Low    |
| Strongly Disagree | Low    |

The system uses **item-level transactions** to preserve variability and improve rule quality.

---

## 11. Challenges & Solutions

### Issue: Homogeneous Data (All Medium)

* Cause: Over-aggregation
* Solution: Switched to granular item-level representation

### Issue: Incorrect Classification

* Cause: String matching conflicts
* Solution: Reordered preprocessing logic

### Issue: Git Submodule Conflict

* Cause: Nested repository in frontend
* Solution: Removed submodule and restructured tracking

---

## 12. Performance Considerations

* Hash-based pruning reduces candidate sets
* Transaction reduction improves efficiency
* Adjustable thresholds control rule volume

---

## 13. Managerial Value

This system enables managers to:

* Identify key drivers of dissatisfaction
* Understand relationships between workplace factors
* Make data-driven decisions
* Prioritize interventions based on impact

---

## 14. Future Enhancements

* Recommendation engine based on rules
* Advanced filtering (multi-factor relationships)
* Correlation heatmaps
* Real-time analytics

---

## 15. Author

MSc Computer Engineering Student
Manager Analytics Dissertation Project

---

## 16. License

For academic and research use only.
