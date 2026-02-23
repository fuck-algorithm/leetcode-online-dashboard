export interface APIEndpoint {
  key: string;
  title: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  detailedDescription?: string;
  useCases?: string[];
  requestParams?: { 
    name: string; 
    type: string; 
    required: boolean; 
    description: string; 
    default?: string;
    example?: string;
  }[];
  responseFields?: {
    field: string;
    type: string;
    description: string;
  }[];
  responseExample: any;
  errorExamples?: { code: number; message: string; example: any }[];
}
