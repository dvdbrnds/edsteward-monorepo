#!/usr/bin/env node

/**
 * MCP Implementation Progress Tracker
 * 
 * A tool to help track progress through the implementation checklist.
 */

import fs from 'fs';
import readline from 'readline';
import chalk from 'chalk';

const CHECKLIST_FILE = 'mcp-validation-checklist.md';
const PROGRESS_FILE = 'implementation-progress.json';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Default progress structure
const defaultProgress = {
  sections: {
    "Core Architecture Design": {
      completed: false,
      subsections: {
        "MCP Protocol Specification": { completed: false, tasks: [] },
        "Inquisitor Component Design": { completed: false, tasks: [] },
        "Component Interaction Model": { completed: false, tasks: [] }
      }
    },
    "Primary MCP Orchestrator Implementation": {
      completed: false,
      subsections: {
        "Orchestrator Core": { completed: false, tasks: [] },
        "Regulation Classification Engine": { completed: false, tasks: [] },
        "Multi-level Validation Flow": { completed: false, tasks: [] }
      }
    },
    "Regulation-Specific MCP Services": {
      completed: false,
      subsections: {
        "Level 1 Validator - Static Text": { completed: false, tasks: [] },
        "Level 2 Validator - Context Sensitive": { completed: false, tasks: [] },
        "Level 3 Validator - Complex Logic": { completed: false, tasks: [] }
      }
    },
    "Inquisitor Implementation": {
      completed: false,
      subsections: {
        "Validation Rule Engine": { completed: false, tasks: [] },
        "Certification Process": { completed: false, tasks: [] },
        "Advanced Analysis Features": { completed: false, tasks: [] }
      }
    },
    "Version Control System": {
      completed: false,
      subsections: {
        "Change Detection": { completed: false, tasks: [] },
        "Frontend Notification System": { completed: false, tasks: [] },
        "Acceptance Workflow": { completed: false, tasks: [] }
      }
    },
    "Testing and Verification": {
      completed: false,
      subsections: {
        "Unit Testing": { completed: false, tasks: [] },
        "Integration Testing": { completed: false, tasks: [] },
        "Documentation and Examples": { completed: false, tasks: [] }
      }
    }
  },
  currentSection: "Core Architecture Design",
  currentSubsection: "MCP Protocol Specification",
  notes: {}
};

// Load progress data
function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = fs.readFileSync(PROGRESS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading progress:', error);
  }
  return {...defaultProgress};
}

// Save progress data
function saveProgress(progress) {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  } catch (error) {
    console.error('Error saving progress:', error);
  }
}

// Parse the checklist file
function parseChecklist() {
  try {
    const content = fs.readFileSync(CHECKLIST_FILE, 'utf8');
    const lines = content.split('\n');
    
    const progress = loadProgress();
    const sections = progress.sections;
    
    let currentSection = null;
    let currentSubsection = null;
    
    for (const line of lines) {
      // Parse section header (## 1. Core Architecture Design)
      const sectionMatch = line.match(/^## \d+\. (.+)$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1];
        currentSubsection = null;
        if (!sections[currentSection]) {
          sections[currentSection] = { 
            completed: false, 
            subsections: {} 
          };
        }
        continue;
      }
      
      // Parse subsection (- [ ] **MCP Protocol Specification**)
      const subsectionMatch = line.match(/^- \[([ x])\] \*\*(.+)\*\*$/);
      if (subsectionMatch && currentSection) {
        const completed = subsectionMatch[1] === 'x';
        currentSubsection = subsectionMatch[2];
        
        if (!sections[currentSection].subsections[currentSubsection]) {
          sections[currentSection].subsections[currentSubsection] = {
            completed,
            tasks: []
          };
        } else {
          sections[currentSection].subsections[currentSubsection].completed = completed;
        }
        continue;
      }
      
      // Parse task (  - [ ] Define request/response formats for validation messages)
      const taskMatch = line.match(/^  - \[([ x])\] (.+)$/);
      if (taskMatch && currentSection && currentSubsection) {
        const taskCompleted = taskMatch[1] === 'x';
        const taskName = taskMatch[2];
        
        const existingTasks = sections[currentSection].subsections[currentSubsection].tasks;
        
        // Only add if it doesn't exist
        if (!existingTasks.some(task => task.name === taskName)) {
          existingTasks.push({
            name: taskName,
            completed: taskCompleted
          });
        } else {
          // Update existing task completion status
          const taskIndex = existingTasks.findIndex(task => task.name === taskName);
          if (taskIndex >= 0) {
            existingTasks[taskIndex].completed = taskCompleted;
          }
        }
      }
    }
    
    saveProgress(progress);
    return progress;
  } catch (error) {
    console.error('Error parsing checklist:', error);
    return loadProgress();
  }
}

// Update the checklist file with current progress
function updateChecklist(progress) {
  try {
    const content = fs.readFileSync(CHECKLIST_FILE, 'utf8');
    const lines = content.split('\n');
    const newLines = [];
    
    let currentSection = null;
    let currentSubsection = null;
    
    for (const line of lines) {
      // Handle section header
      const sectionMatch = line.match(/^## \d+\. (.+)$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1];
        currentSubsection = null;
        newLines.push(line);
        continue;
      }
      
      // Handle subsection
      const subsectionMatch = line.match(/^- \[([ x])\] \*\*(.+)\*\*$/);
      if (subsectionMatch && currentSection) {
        currentSubsection = subsectionMatch[2];
        const isCompleted = progress.sections[currentSection]?.subsections[currentSubsection]?.completed;
        const checkMark = isCompleted ? 'x' : ' ';
        newLines.push(`- [${checkMark}] **${currentSubsection}**`);
        continue;
      }
      
      // Handle task
      const taskMatch = line.match(/^  - \[([ x])\] (.+)$/);
      if (taskMatch && currentSection && currentSubsection) {
        const taskName = taskMatch[2];
        const tasks = progress.sections[currentSection]?.subsections[currentSubsection]?.tasks || [];
        const task = tasks.find(t => t.name === taskName);
        const checkMark = task?.completed ? 'x' : ' ';
        newLines.push(`  - [${checkMark}] ${taskName}`);
        continue;
      }
      
      // Keep other lines unchanged
      newLines.push(line);
    }
    
    fs.writeFileSync(CHECKLIST_FILE, newLines.join('\n'));
  } catch (error) {
    console.error('Error updating checklist:', error);
  }
}

// Display current progress
function displayProgress(progress) {
  console.log('\n===== MCP Implementation Progress =====\n');
  
  let totalTasks = 0;
  let completedTasks = 0;
  
  Object.entries(progress.sections).forEach(([sectionName, section]) => {
    const sectionTasks = Object.values(section.subsections).reduce((total, subsection) => {
      return total + subsection.tasks.length;
    }, 0);
    
    const sectionCompleted = Object.values(section.subsections).reduce((total, subsection) => {
      return total + subsection.tasks.filter(task => task.completed).length;
    }, 0);
    
    totalTasks += sectionTasks;
    completedTasks += sectionCompleted;
    
    const percentage = sectionTasks > 0 ? Math.round((sectionCompleted / sectionTasks) * 100) : 0;
    
    // Highlight current section
    const isCurrent = sectionName === progress.currentSection;
    
    console.log(`${isCurrent ? chalk.green('→') : ' '} ${sectionName}: ${percentage}% complete (${sectionCompleted}/${sectionTasks})`);
    
    if (isCurrent) {
      Object.entries(section.subsections).forEach(([subsectionName, subsection]) => {
        const subsectionCompleted = subsection.tasks.filter(task => task.completed).length;
        const subsectionTotal = subsection.tasks.length;
        const subPercentage = subsectionTotal > 0 ? Math.round((subsectionCompleted / subsectionTotal) * 100) : 0;
        
        const isCurrentSub = subsectionName === progress.currentSubsection;
        console.log(`   ${isCurrentSub ? chalk.blue('→') : ' '} ${subsectionName}: ${subPercentage}% (${subsectionCompleted}/${subsectionTotal})`);
        
        if (isCurrentSub) {
          subsection.tasks.forEach((task, index) => {
            console.log(`      ${index + 1}. [${task.completed ? 'x' : ' '}] ${task.name}`);
          });
        }
      });
    }
  });
  
  const overallPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  console.log(`\nOverall Progress: ${overallPercentage}% (${completedTasks}/${totalTasks})`);
  console.log('\n=======================================\n');
}

// Navigate to a specific section and subsection
function navigateTo(progress, sectionName, subsectionName) {
  if (progress.sections[sectionName]) {
    progress.currentSection = sectionName;
    
    if (subsectionName && progress.sections[sectionName].subsections[subsectionName]) {
      progress.currentSubsection = subsectionName;
    } else {
      // Default to first subsection
      progress.currentSubsection = Object.keys(progress.sections[sectionName].subsections)[0];
    }
    
    saveProgress(progress);
    return true;
  }
  
  return false;
}

// Add a note to a task
function addNote(progress, section, subsection, taskIndex, note) {
  const key = `${section}:${subsection}:${taskIndex}`;
  progress.notes[key] = note;
  saveProgress(progress);
}

// Mark a task as completed
function markTaskComplete(progress, taskIndex, completed = true) {
  const section = progress.currentSection;
  const subsection = progress.currentSubsection;
  
  if (progress.sections[section]?.subsections[subsection]?.tasks[taskIndex]) {
    progress.sections[section].subsections[subsection].tasks[taskIndex].completed = completed;
    
    // Check if all tasks in subsection are completed
    const allTasksCompleted = progress.sections[section].subsections[subsection].tasks.every(task => task.completed);
    progress.sections[section].subsections[subsection].completed = allTasksCompleted;
    
    // Check if all subsections in section are completed
    const allSubsectionsCompleted = Object.values(progress.sections[section].subsections).every(sub => sub.completed);
    progress.sections[section].completed = allSubsectionsCompleted;
    
    saveProgress(progress);
    updateChecklist(progress);
    return true;
  }
  
  return false;
}

// Move to next task, subsection, or section
function moveToNext(progress) {
  const section = progress.currentSection;
  const subsection = progress.currentSubsection;
  
  const tasks = progress.sections[section]?.subsections[subsection]?.tasks || [];
  const incompleteTaskIndex = tasks.findIndex(task => !task.completed);
  
  if (incompleteTaskIndex !== -1) {
    // There are still incomplete tasks in this subsection
    return;
  }
  
  // All tasks in current subsection are complete, move to next subsection
  const subsections = Object.keys(progress.sections[section].subsections);
  const currentSubIndex = subsections.indexOf(subsection);
  
  if (currentSubIndex < subsections.length - 1) {
    // Move to next subsection
    progress.currentSubsection = subsections[currentSubIndex + 1];
    saveProgress(progress);
    return;
  }
  
  // All subsections in current section are complete, move to next section
  const sections = Object.keys(progress.sections);
  const currentSectionIndex = sections.indexOf(section);
  
  if (currentSectionIndex < sections.length - 1) {
    // Move to next section
    progress.currentSection = sections[currentSectionIndex + 1];
    progress.currentSubsection = Object.keys(progress.sections[progress.currentSection].subsections)[0];
    saveProgress(progress);
  }
}

// Interactive menu to work through the checklist
function showMenu(progress) {
  console.clear();
  displayProgress(progress);
  
  console.log('Choose an action:');
  console.log('1. Mark current task complete');
  console.log('2. Mark current task incomplete');
  console.log('3. Navigate to specific section');
  console.log('4. Add note to current task');
  console.log('5. View next steps');
  console.log('6. Update tasks from checklist file');
  console.log('7. Exit');
  
  rl.question('Enter your choice: ', (choice) => {
    switch (choice) {
      case '1': {
        const section = progress.currentSection;
        const subsection = progress.currentSubsection;
        const tasks = progress.sections[section]?.subsections[subsection]?.tasks || [];
        
        if (tasks.length === 0) {
          console.log('No tasks found in current subsection.');
          setTimeout(() => showMenu(progress), 2000);
          return;
        }
        
        const taskOptions = tasks
          .map((task, index) => `${index + 1}. [${task.completed ? 'x' : ' '}] ${task.name}`)
          .join('\n');
        
        console.log('\nSelect task to mark complete:');
        console.log(taskOptions);
        
        rl.question('Enter task number: ', (taskNum) => {
          const taskIndex = parseInt(taskNum) - 1;
          
          if (isNaN(taskIndex) || taskIndex < 0 || taskIndex >= tasks.length) {
            console.log('Invalid task number');
          } else {
            markTaskComplete(progress, taskIndex, true);
            moveToNext(progress);
          }
          
          setTimeout(() => showMenu(progress), 1000);
        });
        break;
      }
      
      case '2': {
        const section = progress.currentSection;
        const subsection = progress.currentSubsection;
        const tasks = progress.sections[section]?.subsections[subsection]?.tasks || [];
        
        if (tasks.length === 0) {
          console.log('No tasks found in current subsection.');
          setTimeout(() => showMenu(progress), 2000);
          return;
        }
        
        const taskOptions = tasks
          .map((task, index) => `${index + 1}. [${task.completed ? 'x' : ' '}] ${task.name}`)
          .join('\n');
        
        console.log('\nSelect task to mark incomplete:');
        console.log(taskOptions);
        
        rl.question('Enter task number: ', (taskNum) => {
          const taskIndex = parseInt(taskNum) - 1;
          
          if (isNaN(taskIndex) || taskIndex < 0 || taskIndex >= tasks.length) {
            console.log('Invalid task number');
          } else {
            markTaskComplete(progress, taskIndex, false);
          }
          
          setTimeout(() => showMenu(progress), 1000);
        });
        break;
      }
      
      case '3': {
        const sections = Object.keys(progress.sections);
        const sectionOptions = sections
          .map((section, index) => `${index + 1}. ${section}`)
          .join('\n');
        
        console.log('\nSelect section:');
        console.log(sectionOptions);
        
        rl.question('Enter section number: ', (sectionNum) => {
          const sectionIndex = parseInt(sectionNum) - 1;
          
          if (isNaN(sectionIndex) || sectionIndex < 0 || sectionIndex >= sections.length) {
            console.log('Invalid section number');
            setTimeout(() => showMenu(progress), 1000);
            return;
          }
          
          const selectedSection = sections[sectionIndex];
          const subsections = Object.keys(progress.sections[selectedSection].subsections);
          const subsectionOptions = subsections
            .map((subsection, index) => `${index + 1}. ${subsection}`)
            .join('\n');
          
          console.log('\nSelect subsection:');
          console.log(subsectionOptions);
          
          rl.question('Enter subsection number: ', (subsectionNum) => {
            const subsectionIndex = parseInt(subsectionNum) - 1;
            
            if (isNaN(subsectionIndex) || subsectionIndex < 0 || subsectionIndex >= subsections.length) {
              console.log('Invalid subsection number');
            } else {
              navigateTo(progress, selectedSection, subsections[subsectionIndex]);
            }
            
            setTimeout(() => showMenu(progress), 1000);
          });
        });
        break;
      }
      
      case '4': {
        const section = progress.currentSection;
        const subsection = progress.currentSubsection;
        const tasks = progress.sections[section]?.subsections[subsection]?.tasks || [];
        
        if (tasks.length === 0) {
          console.log('No tasks found in current subsection.');
          setTimeout(() => showMenu(progress), 2000);
          return;
        }
        
        const taskOptions = tasks
          .map((task, index) => `${index + 1}. ${task.name}`)
          .join('\n');
        
        console.log('\nSelect task to add note:');
        console.log(taskOptions);
        
        rl.question('Enter task number: ', (taskNum) => {
          const taskIndex = parseInt(taskNum) - 1;
          
          if (isNaN(taskIndex) || taskIndex < 0 || taskIndex >= tasks.length) {
            console.log('Invalid task number');
            setTimeout(() => showMenu(progress), 1000);
            return;
          }
          
          rl.question('Enter note: ', (note) => {
            addNote(progress, section, subsection, taskIndex, note);
            console.log('Note added');
            setTimeout(() => showMenu(progress), 1000);
          });
        });
        break;
      }
      
      case '5': {
        // View next steps
        const section = progress.currentSection;
        const subsection = progress.currentSubsection;
        const tasks = progress.sections[section]?.subsections[subsection]?.tasks || [];
        
        console.log('\nNext Steps:');
        console.log(`Current Section: ${section}`);
        console.log(`Current Subsection: ${subsection}`);
        
        const incompleteTasks = tasks
          .map((task, index) => ({ ...task, index }))
          .filter(task => !task.completed);
        
        if (incompleteTasks.length > 0) {
          console.log('\nIncomplete tasks in current subsection:');
          incompleteTasks.forEach(task => {
            console.log(`- ${task.name}`);
          });
        } else {
          console.log('\nAll tasks in current subsection are complete!');
          
          // Find next subsection with incomplete tasks
          const subsections = Object.keys(progress.sections[section].subsections);
          const currentSubIndex = subsections.indexOf(subsection);
          
          let nextSubsection = null;
          
          for (let i = currentSubIndex + 1; i < subsections.length; i++) {
            const sub = subsections[i];
            const subTasks = progress.sections[section].subsections[sub].tasks;
            if (subTasks.some(task => !task.completed)) {
              nextSubsection = sub;
              break;
            }
          }
          
          if (nextSubsection) {
            console.log(`\nNext subsection: ${nextSubsection}`);
            const nextTasks = progress.sections[section].subsections[nextSubsection].tasks
              .filter(task => !task.completed);
            
            console.log('\nIncomplete tasks in next subsection:');
            nextTasks.forEach(task => {
              console.log(`- ${task.name}`);
            });
          } else {
            console.log('\nAll subsections in current section are complete!');
            
            // Find next section with incomplete tasks
            const sections = Object.keys(progress.sections);
            const currentSectionIndex = sections.indexOf(section);
            
            if (currentSectionIndex < sections.length - 1) {
              const nextSection = sections[currentSectionIndex + 1];
              console.log(`\nNext section: ${nextSection}`);
            } else {
              console.log('\nAll sections are complete! Congratulations!');
            }
          }
        }
        
        rl.question('\nPress Enter to continue...', () => {
          showMenu(progress);
        });
        break;
      }
      
      case '6':
        // Reload and parse checklist
        console.log('\nUpdating tasks from checklist file...');
        progress = parseChecklist();
        setTimeout(() => showMenu(progress), 1000);
        break;
      
      case '7':
        console.log('\nExiting...');
        rl.close();
        process.exit(0);
        break;
      
      default:
        console.log('Invalid choice');
        setTimeout(() => showMenu(progress), 1000);
    }
  });
}

// Main function
function main() {
  console.log('MCP Implementation Progress Tracker');
  console.log('----------------------------------');
  
  // Parse checklist and load progress
  const progress = parseChecklist();
  
  // Start the interactive menu
  showMenu(progress);
}

// Start the program
main(); 