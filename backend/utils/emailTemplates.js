// Natural conversation templates for warm-up
const warmupTopics = {
  casual: [
    {
      subject: "Quick question about the weekend",
      body: "Hey! Did you end up going to that event you mentioned? I'm curious how it went."
    },
    {
      subject: "Following up from last week",
      body: "Hi there! I was thinking about our conversation from last week. Have you made any progress on that project?"
    },
    {
      subject: "Book recommendation",
      body: "Hey! I just finished reading an amazing book and thought you might enjoy it. Have you read anything good lately?"
    }
  ],
  tech: [
    {
      subject: "That new tool you mentioned",
      body: "Hi! I finally got around to trying out that tool you recommended. It's pretty impressive so far. How long have you been using it?"
    },
    {
      subject: "Quick tech question",
      body: "Hey, I remember you mentioning you worked with [topic]. Do you have any recommendations for getting started?"
    }
  ],
  work: [
    {
      subject: "Checking in",
      body: "Hi! Hope you're doing well. I wanted to check in and see how things are going on your end."
    },
    {
      subject: "Quick update",
      body: "Hey! Just wanted to give you a quick update on what we discussed. Things are moving forward nicely."
    }
  ]
};

const replies = [
  "That's great to hear! I've been meaning to look into that myself.",
  "Thanks for sharing! I really appreciate it.",
  "Interesting perspective. I hadn't thought about it that way.",
  "Absolutely! I totally agree with you on that point.",
  "That makes a lot of sense. Thanks for clarifying!",
  "Ha! That's funny. I had a similar experience last week.",
  "I see what you mean. Let me think about that and get back to you.",
  "Perfect timing - I was just thinking about this yesterday!",
  "That's really helpful, thank you! I'll give it a try.",
  "Great suggestion! I'll look into that this week."
];

function getRandomTemplate() {
  const categories = Object.keys(warmupTopics);
  const category = categories[Math.floor(Math.random() * categories.length)];
  const templates = warmupTopics[category];
  return templates[Math.floor(Math.random() * templates.length)];
}

function getRandomReply() {
  return replies[Math.floor(Math.random() * replies.length)];
}

function personalizeEmail(template, variables = {}) {
  let { subject, body } = template;
  
  // Replace variables like {{first_name}}, {{company}}, etc.
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    subject = subject.replace(regex, variables[key] || '');
    body = body.replace(regex, variables[key] || '');
  });
  
  return { subject, body };
}

module.exports = {
  warmupTopics,
  replies,
  getRandomTemplate,
  getRandomReply,
  personalizeEmail
};
