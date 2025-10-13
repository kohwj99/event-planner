// Define the data model for a guest entry
export interface Guest {
  salutation: string;
  name: string;
  gender: 'M' | 'F';
  country: string;
  company: string;
  title: string;
  ranking: number; // 1–10, where 1–4 are VIPs
}

// Host company guest list
export const hostGuests: Guest[] = [
  { salutation: 'Mr.', name: 'John Smith', gender: 'M', country: 'USA', company: 'TechCorp', title: 'CEO', ranking: 1 },
  { salutation: 'Ms.', name: 'Sarah Johnson', gender: 'F', country: 'USA', company: 'TechCorp', title: 'CTO', ranking: 2 },
  { salutation: 'Dr.', name: 'Michael Brown', gender: 'M', country: 'USA', company: 'TechCorp', title: 'VP Engineering', ranking: 3 },
  { salutation: 'Mrs.', name: 'Emily Davis', gender: 'F', country: 'USA', company: 'TechCorp', title: 'VP Marketing', ranking: 4 },
  { salutation: 'Mr.', name: 'David Wilson', gender: 'M', country: 'USA', company: 'TechCorp', title: 'Director Sales', ranking: 5 },
  { salutation: 'Ms.', name: 'Lisa Chen', gender: 'F', country: 'Singapore', company: 'TechCorp', title: 'Product Manager', ranking: 6 },
  { salutation: 'Mr.', name: 'Robert Taylor', gender: 'M', country: 'UK', company: 'TechCorp', title: 'Senior Developer', ranking: 7 },
  { salutation: 'Ms.', name: 'Anna Martinez', gender: 'F', country: 'Mexico', company: 'TechCorp', title: 'Designer', ranking: 8 },
  { salutation: 'Mr.', name: 'James Anderson', gender: 'M', country: 'Canada', company: 'TechCorp', title: 'Analyst', ranking: 9 },
  { salutation: 'Ms.', name: 'Maria Garcia', gender: 'F', country: 'Spain', company: 'TechCorp', title: 'Coordinator', ranking: 10 },
  { salutation: 'Mr.', name: 'Charles Lee', gender: 'M', country: 'USA', company: 'TechCorp', title: 'Operations Lead', ranking: 1 },
  { salutation: 'Ms.', name: 'Jessica Tan', gender: 'F', country: 'Singapore', company: 'TechCorp', title: 'Finance Manager', ranking: 2 },
  { salutation: 'Dr.', name: 'William Thompson', gender: 'M', country: 'USA', company: 'TechCorp', title: 'Research Director', ranking: 3 },
  { salutation: 'Mrs.', name: 'Stephanie Hall', gender: 'F', country: 'Australia', company: 'TechCorp', title: 'HR Director', ranking: 4 },
  { salutation: 'Mr.', name: 'Daniel Rodriguez', gender: 'M', country: 'USA', company: 'TechCorp', title: 'Tech Lead', ranking: 5 },
  { salutation: 'Ms.', name: 'Michelle Kim', gender: 'F', country: 'South Korea', company: 'TechCorp', title: 'UX Manager', ranking: 6 },
  { salutation: 'Mr.', name: 'Kevin O’Brien', gender: 'M', country: 'Ireland', company: 'TechCorp', title: 'Security Manager', ranking: 7 },
  { salutation: 'Ms.', name: 'Crystal Foster', gender: 'F', country: 'USA', company: 'TechCorp', title: 'Brand Manager', ranking: 8 },
  { salutation: 'Mr.', name: 'Nathan Hughes', gender: 'M', country: 'USA', company: 'TechCorp', title: 'Platform Engineer', ranking: 9 },
  { salutation: 'Mrs.', name: 'Vanessa Ward', gender: 'F', country: 'USA', company: 'TechCorp', title: 'Legal Counsel', ranking: 10 }
];

// External guest list
export const externalGuests: Guest[] = [
  { salutation: 'Mr.', name: 'Zhang Wei', gender: 'M', country: 'China', company: 'Global Industries', title: 'Chairman', ranking: 1 },
  { salutation: 'Ms.', name: 'Priya Sharma', gender: 'F', country: 'India', company: 'Innovation Ltd', title: 'CEO', ranking: 2 },
  { salutation: 'Dr.', name: 'Hans Müller', gender: 'M', country: 'Germany', company: 'Euro Solutions', title: 'Managing Director', ranking: 3 },
  { salutation: 'Mrs.', name: 'Sophie Dubois', gender: 'F', country: 'France', company: 'Luxury Brands', title: 'President', ranking: 4 },
  { salutation: 'Mr.', name: 'Carlos Rodriguez', gender: 'M', country: 'Spain', company: 'Mediterranean Corp', title: 'VP Operations', ranking: 5 },
  { salutation: 'Ms.', name: 'Yuki Tanaka', gender: 'F', country: 'Japan', company: 'Tech Innovations', title: 'Director', ranking: 6 },
  { salutation: 'Mr.', name: 'Ahmed Hassan', gender: 'M', country: 'UAE', company: 'Middle East Holdings', title: 'Manager', ranking: 7 },
  { salutation: 'Ms.', name: 'Emma Thompson', gender: 'F', country: 'UK', company: 'British Ventures', title: 'Senior Consultant', ranking: 8 },
  { salutation: 'Mr.', name: 'Marco Rossi', gender: 'M', country: 'Italy', company: 'Mediterranean Enterprises', title: 'Specialist', ranking: 9 },
  { salutation: 'Ms.', name: 'Olga Petrov', gender: 'F', country: 'Russia', company: 'Eastern Partners', title: 'Associate', ranking: 10 },
  { salutation: 'Dr.', name: 'Lars Andersen', gender: 'M', country: 'Denmark', company: 'Nordic Tech', title: 'CTO', ranking: 1 },
  { salutation: 'Ms.', name: 'Isabella Silva', gender: 'F', country: 'Brazil', company: 'South American Corp', title: 'VP Marketing', ranking: 2 },
  { salutation: 'Mr.', name: 'Raj Patel', gender: 'M', country: 'India', company: 'Mumbai Ventures', title: 'COO', ranking: 3 },
  { salutation: 'Mrs.', name: 'Marie Leclerc', gender: 'F', country: 'Canada', company: 'Maple Leaf Industries', title: 'CFO', ranking: 4 },
  { salutation: 'Mr.', name: 'Hiroshi Yamamoto', gender: 'M', country: 'Japan', company: 'Tokyo Dynamics', title: 'Research Head', ranking: 5 },
  { salutation: 'Ms.', name: 'Fatima Al-Zahra', gender: 'F', country: 'Morocco', company: 'African Solutions', title: 'Director', ranking: 6 },
  { salutation: 'Dr.', name: 'Erik Johansson', gender: 'M', country: 'Sweden', company: 'Scandinavian Group', title: 'Innovation Lead', ranking: 7 },
  { salutation: 'Ms.', name: 'Anastasia Volkov', gender: 'F', country: 'Russia', company: 'Moscow Enterprises', title: 'Strategy Lead', ranking: 8 },
  { salutation: 'Mr.', name: 'Paulo Santos', gender: 'M', country: 'Brazil', company: 'Rio Innovations', title: 'Product Head', ranking: 9 },
  { salutation: 'Mrs.', name: 'Ingrid Hansen', gender: 'F', country: 'Norway', company: 'Arctic Solutions', title: 'Operations Director', ranking: 10 }
];
