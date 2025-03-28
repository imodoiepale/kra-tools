// @ts-nocheck
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Toaster, toast } from 'react-hot-toast';

export default function AddUserPage() {
  const router = useRouter();
  const addUser = useMutation(api.users.addUser);
  const users = useQuery(api.users.getUsers);
  
  const [formData, setFormData] = useState({
    name: '',
    idNumber: '',
    age: '',
    location: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    
    try {
      console.log('Client: Submitting user data:', formData);
      
      const userId = await addUser({
        name: formData.name,
        idNumber: formData.idNumber,
        age: formData.age,
        location: formData.location,
      });
      
      console.log('Client: Successfully added user with ID:', userId);
      
      toast.success('User added successfully!');
      
      // Clear form
      setFormData({
        name: '',
        idNumber: '',
        age: '',
        location: ''
      });
      
    } catch (error) {
      console.error('Client: Error adding user:', error);
      setError(error);
      toast.error('Failed to add user. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Form Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold mb-6">Add New User</h1>
          
          {error && (
            <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
              <span className="block sm:inline">{error.message}</span>
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="idNumber" className="block text-sm font-medium text-gray-700 mb-1">
                ID Number
              </label>
              <input
                type="text"
                id="idNumber"
                name="idNumber"
                value={formData.idNumber}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-1">
                Age
              </label>
              <input
                type="number"
                id="age"
                name="age"
                value={formData.age}
                onChange={handleChange}
                required
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-6">
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Adding User...' : 'Add User'}
            </button>
          </form>
        </div>

        {/* Data Display Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Submitted Users</h2>
          {users === undefined ? (
            <div>Loading...</div>
          ) : users === null ? (
            <div>Error loading users</div>
          ) : users.length === 0 ? (
            <div>No users yet</div>
          ) : (
            <div className="space-y-4">
              {users.map((user: any) => (
                <div key={user._id} className="border p-4 rounded-lg">
                  <p><strong>Name:</strong> {user.name}</p>
                  <p><strong>ID:</strong> {user.idNumber}</p>
                  <p><strong>Age:</strong> {user.age}</p>
                  <p><strong>Location:</strong> {user.location}</p>
                  <p className="text-sm text-gray-500">
                    Added: {new Date(user.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}