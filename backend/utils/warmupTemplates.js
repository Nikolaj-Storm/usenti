/**
 * Spintax parsing engine and template library for highly dynamic, 
 * Instantly-level B2B warmup emails.
 */

/**
 * Recursively resolves a Spintax string like "{Hi|Hello} {there|friend}!"
 * Handles nested Spintax: e.g., "{{Good morning|Morning}|Hi}!"
 * @param {string} text - The raw spintax string
 * @returns {string} - A fully resolved, randomized string
 */
function resolveSpintax(text) {
    if (!text) return '';

    // Regex to find the innermost {a|b|c} block
    const spintaxRegex = /\{([^{}]+)\}/;
    let match;

    let resolvedText = text;
    while ((match = spintaxRegex.exec(resolvedText)) !== null) {
        // match[1] contains the string inside the braces, e.g., "a|b|c"
        const options = match[1].split('|');
        const selection = options[Math.floor(Math.random() * options.length)];

        // Replace that specific block with the chosen selection
        resolvedText = resolvedText.substring(0, match.index) + selection + resolvedText.substring(match.index + match[0].length);
    }

    return resolvedText;
}

// ============================================================================
// TEMPLATE LIBRARIES
// ============================================================================

// --- INITIAL SENDS (Outbound) ---
const INITIAL_SUBJECTS = [
    "{Quick|Brief} {question|inquiry} {about|regarding} {your|the} {services|platform|software}",
    "{Following up|Checking in} on {our|the} {last|previous} {conversation|chat|discussion}",
    "{Are you|Would you be} {available|free} for a {quick|brief} {chat|call|sync}?",
    "{Looking for|Seeking} some {advice|feedback|input} on {marketing|sales|development}",
    "{Checking in|Touching base} on the {project|initiative} {status|progress}",
    "{Thoughts|Feedback} on the {new|latest} {update|release|feature}?",
    "{Meeting|Call} {request|invite} for {next week|later this week}",
    "{Introduction|Intro} - {Partnership|Synergy} {opportunity|exploration}",
    "{Can we|Should we} {connect|chat} {soon|this week}?",
    "Question {about|regarding} {pricing|features|integration}"
];

const INITIAL_BODIES = [
    "{Hi|Hello|Hey|Greetings} {there|friend|team},\n\nI was {wondering|hoping} if you had a few {minutes|moments} to {chat|talk|speak} about some of the {services|solutions|products} you offer. Please let me know when you're {free|available|open}.\n\n{Best|Cheers|Thanks|Regards},\n",

    "{Hello|Hi},\n\n{Just|I'm} {following up|checking in} on our {previous|last} {email|conversation}. Were you able to {review|look over|read} the {document|file|proposal} I sent {over|across}?\n\n{Thanks|Appreciate it},\n",

    "{Hey|Hi|Hello},\n\nI'm {looking for|seeking} some {advice|guidance|input} on a {project|task} I'm {working on|handling} and thought you might be the {right|best} person to {ask|consult}. Could we {schedule|book} a quick {call|sync}?\n\n{Cheers|Best regards},\n",

    "{Hi|Greetings},\n\n{Hope|I hope} you're having a {great|good|productive} week. I wanted to {check in|touch base} and see if there are any {updates|news} on your end regarding the {new|upcoming} project phase.\n\n{Best regards|Thanks so much},\n",

    "{Hello|Hi there},\n\nI saw your {recent|latest} {update|post|announcement} and wanted to share a few {thoughts|ideas}. Let me know if you have time to {connect|chat} {later this week|sometime soon}.\n\n{Thanks|Best},\n",

    "{Hey|Hi},\n\n{We are|I am} {currently evaluating|looking into} {solutions|platforms} like yours. {Do you have|Is there} a {time|slot} we could {jump on|hop on} a {brief|quick} {demo|call} to {discuss further|learn more}?\n\n{Thanks|Regards},\n",

    "{Greetings|Hello},\n\nI {stumbled across|found} your {company|site|profile} and was {impressed|intrigued} by your {work|offering}. {Would love to|I'd like to} explore potential {synergies|partnerships}. {When are you free?|What does your calendar look like?}\n\n{Best|Talk soon},\n"
];

// --- REPLIES (Inbound) ---
const REPLY_BODIES = [
    "{Hi|Hello|Hey},\n\n{Thanks|Thank you} for {reaching out|the note|getting in touch}. {Yes|Absolutely}, {I have some time|I'm free} {tomorrow|next week|on Thursday}. {Does that work for you?|Let me know if that fits your schedule.}\n\n{Best|Thanks},\n",

    "{Hey|Hi there},\n\n{I received|Got} your {message|email}. {I'm currently reviewing|I'll take a look at} the {details|info} and will {get back to you|reply} {shortly|by EOD|tomorrow}.\n\n{Cheers|Regards},\n",

    "{Hello|Hi},\n\n{Great to hear from you|Thanks for following up}. {I'm definitely interested.|That sounds good.} {Could you|Can you} {send over|provide} a bit more {information|context|details} before we {chat|hop on a call}?\n\n{Best regards|Thanks},\n",

    "{Hi|Hey},\n\n{Apologies for the delay|Sorry for the late reply}. {Things have been busy here|I've been tied up}. {I'd love to|I'm happy to} {connect|chat}. {What time works best for you?|Send over some times that work.}\n\n{Thanks|Best},\n",

    "{Greetings|Hello},\n\n{Thanks for the update|Appreciate the info}. {Everything looks good|This looks great} on my end. Let's {proceed|move forward} as {discussed|planned}.\n\n{Talk soon|Regards},\n",

    "{Hi|Hello},\n\n{Unfortunately|I'm afraid} {I'm swamped|my plate is full} {this week|right now}. {Can we|Could we} {reschedule|push this} to {next week|early next month}?\n\n{Thanks for understanding|Best},\n"
];

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Generate a highly unique, Spintax-resolved warmup email payload.
 * @param {string} tag - The invisible tracker tag
 * @param {boolean} isReply - Whether to draw from the Reply pool instead of Initial Sends
 * @returns {subject, body}
 */
function generateDynamicContent(tag, isReply = false) {
    let rawSubject = '';
    let rawBody = '';

    if (isReply) {
        // Replies usually don't need a new subject (handled by emailService Threading), 
        // but if requested, we could provide one.
        rawSubject = "Re: " + resolveSpintax("{Update|Following up|Quick Reply}");
        rawBody = REPLY_BODIES[Math.floor(Math.random() * REPLY_BODIES.length)];
    } else {
        rawSubject = INITIAL_SUBJECTS[Math.floor(Math.random() * INITIAL_SUBJECTS.length)];
        rawBody = INITIAL_BODIES[Math.floor(Math.random() * INITIAL_BODIES.length)];
    }

    const resolvedSubject = resolveSpintax(rawSubject);
    let resolvedBody = resolveSpintax(rawBody);

    // Swap \n for HTML breaks
    resolvedBody = resolvedBody.replace(/\n/g, '<br>');

    // Inject invisible tracking tag at the bottom
    const hiddenTag = `<br><br><span style="display:none; color:transparent; opacity:0; font-size:0px; width:0px; height:0px;">[${tag}]</span>`;

    return {
        subject: resolvedSubject,
        body: resolvedBody + hiddenTag
    };
}

module.exports = {
    resolveSpintax,
    generateDynamicContent
};
