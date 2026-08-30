initCommonLayout('forms');

const FORMS = {
	expense: "https://docs.google.com/forms/d/e/1FAIpQLSeWlJzJjoWAmWohyY4kik12qSl0sBAPzBDBTV9VdUyARYeB7g/viewform?usp=header",
	equipment: "https://docs.google.com/forms/d/e/1FAIpQLSeWlJzJjoWAmWohyY4kik12qSl0sBAPzBDBTV9VdUyARYeB7g/viewform?usp=header",
	inquiry: "https://docs.google.com/forms/d/e/1FAIpQLSeWlJzJjoWAmWohyY4kik12qSl0sBAPzBDBTV9VdUyARYeB7g/viewform?usp=header"
};

function switchForm(key, btn) {
	document.querySelectorAll('.form-tab-btn').forEach(b => b.classList.remove('active'));
	btn.classList.add('active');
	document.getElementById('google-form-iframe').src = FORMS[key] || FORMS.expense;
}
